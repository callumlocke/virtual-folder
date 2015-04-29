import assert from 'assert';
import VirtualFolder, {Change} from '..';

export default async function virtualFolderTest() {
  const folder = new VirtualFolder();

  let c = folder.write('foo.txt', 'hello');
  assert(c instanceof Change);
  assert(c.type === 'add');
  console.log(c);

  c = folder.write('foo.txt', 'hello!');
  assert(c instanceof Change);
  assert(c.type === 'modify');
  console.log(c);

  c = folder.write('foo.txt', new Buffer('hello!'));
  assert.strictEqual(c, null);

  c = folder.write('foo.txt', null);
  assert(c instanceof Change);
  assert(c.type === 'delete');
  console.log(c);

  c = folder.write('bar.txt', null);
  assert(c === null);

  c = folder.write('bar.txt', Buffer('barrr'));
  assert(c.type === 'add');
  assert(c.oldContents === null);
  assert(c.contents.toString() === 'barrr');
  console.log(c);

  c = folder.write('foo.txt', null);
  assert(c === null);
}
