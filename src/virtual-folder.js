'use strict';

import isString from 'lodash/lang/isString';
import Change from './change';
import bufferEqual from 'buffer-equal';
import {EventEmitter} from 'events';

const FILES = Symbol();


export default class VirtualFolder extends EventEmitter {
  constructor() {
    super();
    this[FILES] = {};
  }


  /**
   * Gets the contents of a file.
   */
  read(filename) {
    return this[FILES][filename] || null;
  }


  /**
   * Sets the contents of a file.
   */
  write(filename, contents) {
    const folder = this;

    // validate input
    if (!isString(filename)) throw new TypeError('Expected filename to be a string; got: ' + typeof filename);
    if (isString(contents)) contents = new Buffer(contents);
    else if (contents !== null && !Buffer.isBuffer(contents)) {
      throw new TypeError('Exected contents to be a buffer, string or null; got: ' + typeof contents);
    }

    // check what the old contents was before updating it
    const oldContents = folder.read(filename);

    // update our record of this file's contents
    if (contents) folder[FILES][filename] = contents;
    else delete folder[FILES][filename];

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
      const change = new Change({filename, contents, oldContents, type});
      folder.emit('change', change);
      return change;
    }

    return null;
  }


  getAllFilenames() {
    return Object.keys(this[FILES]);
  }
}


// expose the Change class for test purposes
VirtualFolder.Change = Change;
