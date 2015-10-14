import prettyBytes from 'pretty-bytes';

export default class Change {
  constructor({file, contents, oldContents, type}) {
    this.file = file;
    this.contents = contents;
    this.oldContents = oldContents;
    this.type = type;
  }

  /**
   * Makes change objects appear nicely in console.logs.
   */
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

    return `<CHANGE: ${this.type} ${this.file} (${amount})>`;
  }

  /**
   * Get a string saying how much the contents have changed in size.
   */
  get sizeDifference() {
    const difference = (
      (this.contents ? this.contents.length : 0) -
      (this.oldContents ? this.oldContents.length : 0)
    );

    return difference >= 0 ? `+${prettyBytes(difference)}` : prettyBytes(difference);
  }
}
