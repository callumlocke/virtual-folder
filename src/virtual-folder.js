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

  read(filename) {
    return this[FILES][filename] || null;
  }

  write(filename, contents) {
    const folder = this;

    if (!isString(filename)) throw new TypeError('Expected filename to be a string; got: ' + typeof filename);
    if (isString(contents)) contents = new Buffer(contents);
    else if (contents !== null && !Buffer.isBuffer(contents)) throw new TypeError('Exected contents to be a buffer, string or null; got: ' + typeof contents);

    const oldContents = folder.read(filename);

    if (contents) folder[FILES][filename] = contents;
    else delete folder[FILES][filename];

    let type;
    if (oldContents) {
      if (contents) {
        if (!equal(oldContents, contents)) type = 'modify';
      }
      else type = 'delete';
    }
    else if (contents) type = 'add';

    if (type) {
      const change = new Change({filename, contents, oldContents, type});
      folder.emit('change', change);
      return change;
    }

    return null;
  }
}

VirtualFolder.Change = Change;
