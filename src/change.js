'use strict';

import prettyBytes from 'pretty-bytes';

export default class Change {
  constructor({filename, contents, oldContents, type}) {
    this.filename = filename;
    this.contents = contents;
    this.oldContents = oldContents;
    this.type = type;
  }

  inspect() {
    let amount;
    switch(this.type) {
      case 'add':
        amount = prettyBytes(this.contents.length);
        break;
      case 'delete':
        amount = `was ${prettyBytes(this.oldContents.length)}`;
        break;
      case 'modify':
        amount = `${prettyBytes(this.oldContents.length)} => ${prettyBytes(this.contents.length)}`;
    }

    return `<CHANGE: ${this.type} ${this.filename} (${amount})>`;
  }

  get sizeDifference() {
    const value = (
      (this.contents ? this.contents.length : 0) -
      (this.oldContents ? this.oldContents.length : 0)
    );
    return value >= 0 ? `+${prettyBytes(value)}` : prettyBytes(value);
  }
}
