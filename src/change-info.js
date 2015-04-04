export default class ChangeDetail {
  constructor(options) {
    this.type = options.type;
    this.path = options.path;
    this.contents = options.contents;
    this.oldContents = options.oldContents;
  }
}
