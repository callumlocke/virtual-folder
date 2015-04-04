'use strict';

import 'babel/polyfill';
import fs from 'graceful-fs';
import path from 'path';
import which from 'which';
import Promise from 'bluebird';
import bufferEqual from 'buffer-equal';
import ChangeInfo from './change-info';
import {EventEmitter} from 'events';

const readFile = Promise.promisify(fs.readFile);
const unlink = Promise.promisify(fs.unlink);
const writeFile = Promise.promisify(fs.writeFile);

const resolvedNull = Promise.resolve(null);

const defaults = {
  syncMode: 'push', // only applicable if user sets a syncDir
  watchMode: 'auto'
};


export default class VirtualFolder extends EventEmitter {

  /**
   * Create a new virtual folder.
   * 
   * @constructor
   * @param {string} [syncDir]
   * @param {object} [options]
   */
  constructor(syncDir, options) {
    super();

    if (syncDir != null && typeof syncDir !== 'string') {
      throw new TypeError('Expected syncDir to be a string');
    }

    // process configuration
    this.options = Object.assign({}, defaults, options);

    this.syncDir = syncDir;


    // make an object to contain file-reading promises
    this._fileContentsPromises = {};

    // create instance method for filtering files
    this._filter = function () {
      return true; // TODO: based on glob or something
    };
  }


  /**
   * Tells you when the folder is ready for use, i.e. sync'd with any `syncDir`
   * if applicable.
   *
   * Generally this method is for internal use only – the `.get()` and `.set()` 
   * methods check readiness on every call anyway, so you don't need to use it.
   *
   * @method
   * @param {function} [callback]
   */
  ready (callback) {
    const folder = this;
    const options = folder.options;

    // once only: establish a promise that this instance is ready (sync'd with disk)
    if (!folder._ready) {
      folder._ready = new Promise(function (resolve, reject) {

        // if no syncDir, it's ready already
        if (!folder.syncDir) return resolve();

        // function to load all contents of all files in the syncDir
        // (declared up front as we don't know exactly when/if it will be used yet)
        const loadAllFileContents = (function () {
          // Get a promise to load a single file, and also add it to the general
          // BAD SMELL: I don't like the way this performs an essential task (adding to _fileContentsPromises) as a side-effect to its ostensible purpose.
          function loadFile (relPath) {
            return new Promise(function (resolve) {
              const gotContents = readFile(path.resolve(folder.syncDir, relPath));

              folder._fileContentsPromises[relPath] = gotContents;

              gotContents.then(resolve, reject);
            });
          }

          return function loadAllFileContents () {
            return new Promise(function (resolve, reject) {
              const filewalker = require('filewalker');
              const contentsPromises = [];

              filewalker(folder.syncDir)
                .on('file', function (relPath, stat, absPath) {
                  if (folder._filter(relPath)) {
                    contentsPromises.push(loadFile(relPath));
                  }
                })
                .on('done', function () {
                  resolve(Promise.all(contentsPromises));
                })
                .on('error', reject).walk();
            });
          };
        })();

        if (folder.syncDir && options.syncMode === 'pull') {
          const sane = require('sane');

          // asynchronously decide whether to use watchman
          const decidedOnWatchman = new Promise(function (resolve) {
            if (options.watchMode === 'watchman') return resolve(true);

            if (options.watchMode === 'poll') return resolve(false);

            if (options.watchMode === 'auto') return resolve(VirtualFolder._systemHasWatchman());

            throw new TypeError('Unexpected value for options.watchMode: ' + options.watchMode);
          });

          decidedOnWatchman.then(function (useWatchman) {
            // note to assist with debugging
            folder._usingWatchman = useWatchman;

            // create the sane watcher
            folder._watcher = sane(folder.syncDir, {
              watchman: useWatchman,
              poll: (options.watchMode === 'poll'),
              dot: true
            });

            // wait for then sane watcher to be ready
            folder._watcher.on('ready', function () {
              if (folder._watcher.dirRegistery) {
                // sane's list of watched files is available. (nb. it's not always available, e.g. when using watchman.)
                // just use this to save time, then return

                // TODO (the following commented lines are from an old version, which just gets a list of files as opposed to actually loading their contents)

                // files = [];
                // ref = _this._watcher.dirRegistery;
                // for (dir in ref) {
                //   fileList = ref[dir];
                //   for (fileName in fileList) {
                //     files.push(path.relative(_this.Dir, path.join(dir, fileName)));
                //   }
                // }
                // justFiles = [];
                // async.each(files, function(file, done) {
                //   if (!_this._filter(file)) {
                //     done();
                //     return;
                //   }
                //   return fs.stat(path.join(_this.syncDir, file), function(err, stat) {
                //     if (err != null) {
                //       throw err;
                //     }
                //     if (stat.isFile()) {
                //       justFiles.push(file);
                //     }
                //     done();
                //   });
                // }, function(err) {
                //   if (err != null) {
                //     reject(err);
                //   } else {
                //     resolve(justFiles);
                //   }
                // });
              }

              loadAllFileContents().then(resolve, reject);
            });
            
            // handle events from the sane watcher
            ['change', 'add', 'delete'].forEach(function (type) {
              folder._watcher.on(type, function (relPath, root, stat) {
                if (stat == null) {
                  // the file on disk was deleted.
                  console.assert(type === 'delete', `unexpected type: ${type}`);
                  
                  // see if the file exists in the virtual folder (might not if it was a very quick create-and-delete)
                  const gotOldContents = folder._fileContentsPromises[relPath] || resolvedNull;

                  gotOldContents.then(function (oldContents) {
                    if (oldContents != null) {
                      // delete the copy from the virtual folder
                      delete folder._fileContentsPromises[relPath];

                      // emit a change event
                      folder.emit('change', new ChangeInfo({
                        path: relPath,
                        type: 'deleted',
                        contents: null,
                        oldContents: oldContents
                      }));
                    }
                  });
                }

                else if (stat.isFile()) {
                  // the file on disk has been modified or created.
                  console.assert(type === 'change' || type === 'add', `unexpected type: ${type}`);

                  // get the new contents from disk, and the old contents from the virtual file
                  const absPath = path.resolve(folder.syncDir, relPath);
                  const gotNewContents = readFile(absPath);
                  const gotOldContents = folder._fileContentsPromises[relPath] || resolvedNull;

                  // update the central promise for this file immediately
                  folder._fileContentsPromises[relPath] = gotNewContents;

                  // if anything actually changed, emit a change event
                  Promise.all([gotOldContents, gotNewContents]).then(function ([oldContents, newContents]) {
                    if (!bufferEqual(newContents, oldContents)) {
                      folder.emit('change', new ChangeInfo({
                        path: relPath,
                        type: (oldContents ? 'modified' : 'created'),
                        contents: newContents,
                        oldContents: oldContents
                      }));
                    }
                  });
                }
              });
            });

          }, reject);

        }
        else {
          // this must be in 'push' mode.
          resolve(loadAllFileContents());
        }
      });

      // only once: emit the 'ready' event
      folder._ready.then(function () {
        return folder.emit('ready');
      });
    }

    // call back if appropriate
    if (callback) {
      Promise.resolve(folder._ready).asCallback(callback);
    }

    // Return the single _ready promise
    return folder._ready;
  }

  /**
  * Sets the contents of a given file in the folder.
  * In 'push' mode, this also results in any change being persisted to disk.
  *
  * @method
  * @param {string} filename
  * @param {string|Buffer} contents
  * @param {function} [callback]
  */
  set(filename, contents, callback) {
    const folder = this;

    // prohibit calling this in pull mode
    if (folder.options.syncMode === 'pull') {
      throw new Error('Cannot manually call .set() when syncMode is "pull"');
    }

    // process contents argument
    if (contents !== null) {
      if (typeof contents === 'string') {
        contents = new Buffer(contents);
      }
      else if (!Buffer.isBuffer(contents)) {
        throw new TypeError('Expected contents to be buffer, string, or null');
      }
    }

    // make a promise for when this set call is done
    const setPromise = new Promise(function (resolve) {
      folder.ready().then(function () {
        // get the old contents
        (folder._fileContentsPromises[filename] || resolvedNull).then(function (oldContents) {
          let persistedChange;
          let changeInfo;

          if (contents === null && oldContents !== null) {
            // the old file existed, and this .set() call deletes it.

            // remove the central contents promise for this file (so future .get() calls know it's gone)
            delete folder._fileContentsPromises[filename];

            // promise to persist the deletion to disk, if necessary
            if (folder.syncDir && folder.options.syncMode === 'push') {
              persistedChange = unlink(path.resolve(folder.syncDir, filename));
              // TODO: delete dir if it's the last thing in there!
            }

            changeInfo = new ChangeInfo({
              type: 'deleted',
              path: filename,
              contents: contents,
              oldContents: oldContents
            });
          }

          else if (Buffer.isBuffer(contents) && !bufferEqual(contents, oldContents)) {
            // this .set() call changes/creates the contents.

            // overwrite the central contents promise for this file (so future .get() calls work correctly)
            folder._fileContentsPromises[filename] = Promise.resolve(contents);

            if (folder.syncDir && folder.options.syncMode === 'push') {
              // TODO: create dirs first, as necessary, based on knowledge of created files!
              persistedChange = writeFile(path.resolve(folder.syncDir, filename), contents);
            }

            changeInfo = new ChangeInfo({
              type: (oldContents ? 'modified' : 'created'),
              path: filename,
              contents: contents,
              oldContents: oldContents
            });
          }

          // resolve as appropriate
          if (changeInfo) {
            // contents changed - wait to persist to disk (if applic.) then emit & resolve
            (persistedChange || Promise.resolve()).then(function () {
              folder.emit('change', changeInfo);
              resolve(changeInfo);
            });
          }
          else {
            // no change resulted from this set.
            // just resolve null
            resolve(null);
          }
        });
      });
    });

    // handle callback-style invocation
    if (callback != null) {
      setPromise.asCallback(callback);
    }

    // return the promise
    return setPromise;
  }

  /**
  * Gets the contents of a given path, or `null` if there is no file at that
  * path.
  *
  * @method
  * @param {string} filename
  * @param {function} [callback]
  */
  get(filename, callback) {
    const folder = this;

    const getPromise = new Promise(function (resolve, reject) {
      folder.ready().then(function () {
        // get the contents promise for this file (if exists)
        const contentsPromise = folder._fileContentsPromises[filename];

        if (contentsPromise) resolve(contentsPromise);
        else resolve(resolvedNull);
      }, reject);
    });

    // handle callback-style invocation
    if (callback) {
      getPromise.asCallback(callback);
    }

    // return the promise
    return getPromise;
  }


  /**
  * Closes any filesystem watchers so the process can exit.
  *
  * @method
  */
  stop() {
    if (this._watcher) this._watcher.close();
  }


  /**
  * Returns a promise that fulfills with `true` or `false` indicating whether
  * the system has "watchman" installed on on the system PATH.
  *
  * @function
  */
  static _systemHasWatchman() {
    // do this check only once and remember the result
    if (!VirtualFolder.__systemHasWatchman) {
      switch (process.platform) {
        case 'darwin':
        case 'linux':
        case 'freebsd':
          // check if watchman is on path
          VirtualFolder.__systemHasWatchman = new Promise(function (resolve) {
            which('watchman', function (err) {
              if (err) resolve(false);
              else resolve(true);
            });
          });
          break;

        default:
          // assume no watchman
          VirtualFolder.__systemHasWatchman = Promise.resolve(false);
      }
    }

    return VirtualFolder.__systemHasWatchman;
  }
}

VirtualFolder.ChangeInfo = ChangeInfo;
