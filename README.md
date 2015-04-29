# virtual-folder

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]

A class for an in-memory 'folder' – a place to put buffers with associated filenames. Does not care whether the 'files' exist on disk.

You could just use a plain JavaScript object for the same purpose, but this class add events and some sugar.

## Install

```
$ npm install virtual-folder
```

## Usage

```js
var folder = new Folder();

folder.write('some/file.txt', 'hello'); // returns Change object (see below)

folder.read('some/file.txt'); // returns Buffer('hello');
```

### Methods

#### `.write(filename, contents)`

- `contents` can be a buffer, a string (which will be converted to a buffer), or `null` (meaning 'delete').
- If the call results in a change, the folder will emit a `'change'` event with a `Change` object (see below). The `.write()` call will also return the `Change` object.
- If the call results in no change, it returns `null`.

#### `.read(filename)`

- Returns the contents of `filename`, or `null` if that file doesn't exist.

### `Change` objects

A change is emitted whenever a file's contents are changed by a `.write()` call. (The same change object is also returned from the `.write()` call.)

Properties:

- `filename` – string
- `type` - string (either `"add"`, `"modify"` or `"delete"`)
- `contents` – buffer (or `null` if this change is a "delete")
- `oldContents` – buffer (or `null` if this change is an "add")

It also has an `.inspect()` method, so when you `console.log` a change object, it looks something like this:

```
<CHANGE modify some/foo.txt (12KB => 13KB)>
```


## License

MIT


<!-- badge URLs -->
[npm-url]: https://npmjs.org/package/virtual-folder
[npm-image]: https://img.shields.io/npm/v/virtual-folder.svg?style=flat-square

[travis-url]: http://travis-ci.org/callumlocke/virtual-folder
[travis-image]: https://img.shields.io/travis/callumlocke/virtual-folder.svg?style=flat-square

[depstat-url]: https://david-dm.org/callumlocke/virtual-folder
[depstat-image]: https://img.shields.io/david/callumlocke/virtual-folder.svg?style=flat-square
