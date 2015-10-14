import isString from 'lodash.isstring';
import bufferEqual from 'buffer-equal';
import {EventEmitter} from 'events';
import Change from './change';

const FILES = Symbol();

export class VirtualFolder extends EventEmitter {
  constructor() {
    super();
    this[FILES] = {};
  }

  /**
   * Gets the contents of a file.
   */
  read(file) {
    return this[FILES][file] || null;
  }

  /**
   * Sets the contents of a file.
   */
  write(file, contents) {
    // validate input
    if (!isString(file)) throw new TypeError('Expected file to be a string; got: ' + typeof file);
    if (isString(contents)) contents = new Buffer(contents);
    else if (contents !== null && !Buffer.isBuffer(contents)) {
      throw new TypeError('Exected contents to be a buffer, string or null; got: ' + typeof contents);
    }

    // check what the old contents was before updating it
    const oldContents = this.read(file);

    // update our record of this file's contents
    if (contents) this[FILES][file] = contents;
    else delete this[FILES][file];

    // decide change type, if any
    let type;
    if (oldContents) {
      if (contents) {
        if (!bufferEqual(oldContents, contents)) type = 'modify';
      }
      else type = 'delete';
    }
    else if (contents) type = 'add';

    // respond with a change object, if it changed
    if (type) {
      const change = new Change({file, contents, oldContents, type});
      this.emit('change', change);
      return change;
    }

    return null;
  }

  /**
   * Returns an array of all the file paths currently in the virtual folder.
   */
  getAllPaths() {
    return Object.keys(this[FILES]);
  }
}


export Change from './change';
