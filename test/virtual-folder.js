import assert from 'assert';
import VirtualFolder, {Change} from '..';

export default async function virtualFolderTest() {
  const folder = new VirtualFolder();

  let c = folder.write('foo.txt', 'hello');
  console.log(c);
  assert(c instanceof Change);
  assert(c.type === 'add');

  c = folder.write('foo.txt', 'hello!');
  console.log(c);
  assert(c instanceof Change);
  assert(c.type === 'modify');

  c = folder.write('foo.txt', new Buffer('hello!'));
  assert.strictEqual(c, null);

  c = folder.write('foo.txt', null);
  console.log(c);
  assert(c instanceof Change);
  assert(c.type === 'delete');

  c = folder.write('bar.txt', null);
  assert(c === null);

  c = folder.write('bar.txt', Buffer('barrr'));
  console.log(c);
  assert(c.type === 'add');
  assert(c.oldContents === null);
  assert(c.contents.toString() === 'barrr');

  c = folder.write('foo.txt', null);
  assert(c === null);
}
