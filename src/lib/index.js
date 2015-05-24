'use strict';

import isString from 'lodash.isString';
import bufferEqual from 'buffer-equal';
import {EventEmitter} from 'events';
import Change from './change';

const FILES = Symbol();


export default class VirtualFolder extends EventEmitter {
  constructor() {
    super();
    this[FILES] = {};
  }


  /**
   * Gets the contents of a file.
   */
  read(path) {
    return this[FILES][path] || null;
  }


  /**
   * Sets the contents of a file.
   */
  write(path, contents) {
    const folder = this;

    // validate input
    if (!isString(path)) throw new TypeError('Expected path to be a string; got: ' + typeof path);
    if (isString(contents)) contents = new Buffer(contents);
    else if (contents !== null && !Buffer.isBuffer(contents)) {
      throw new TypeError('Exected contents to be a buffer, string or null; got: ' + typeof contents);
    }

    // check what the old contents was before updating it
    const oldContents = folder.read(path);

    // update our record of this file's contents
    if (contents) folder[FILES][path] = contents;
    else delete folder[FILES][path];

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
      const change = new Change({path, contents, oldContents, type});
      folder.emit('change', change);
      return change;
    }

    return null;
  }


  getAllPaths() {
    return Object.keys(this[FILES]);
  }
}
