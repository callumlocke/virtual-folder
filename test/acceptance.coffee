require('source-map-support').install()

test = require 'tape'
path = require 'path'
wrench = require 'wrench'
fs = require 'fs'
async = require 'async'
VirtualFolder = require '..'
sinon = require 'sinon'

fixtureDir = path.resolve __dirname, '..', 'test', 'fixture'
tmpDir = path.join __dirname, 'tmp'

# function to prepare a tmp dir to experiment with, run before each test
reset = ->
  if fs.existsSync tmpDir
    wrench.rmdirSyncRecursive tmpDir
  wrench.copyDirSyncRecursive fixtureDir, tmpDir


test 'virtual-folder', (t) ->
  t.timeoutAfter 2000

  async.series [
    # test using no sync folder
    (done) ->
      reset()
      folder = new VirtualFolder

      readySpy = sinon.spy()
      folder.on 'ready', readySpy
      changeSpy = sinon.spy()
      folder.on 'change', changeSpy

      Promise.all([
        folder.set('some/file.txt', 'hey'),
        folder.set('some/file2.txt', 'hi')
      ]).then ->
        folder.get 'some/file2.txt', (err, contents) ->
          t.error err, 'No error reading file (no syncDir)'
          t.equal contents.toString(), 'hi', 'Can set file contents (no syncDir)'

          t.ok readySpy.calledOnce, 'Ready called once'
          t.ok changeSpy.calledTwice, 'Change called twice'

          done()
    ,

    # test with a syncDir in 'push' mode
    (done) ->
      reset()
      folder = new VirtualFolder tmpDir

      readySpy = sinon.spy()
      changeSpy = sinon.spy()
      folder.on 'ready', readySpy
      folder.on 'change', changeSpy

      # read something that got initially loaded
      folder.get('one/two/c.txt').then((contents) ->
        t.equal contents.toString(), 'file c\n', 'Can read initial loaded contents (syncMode: push)'
      ).then(->
        folder.set 'a.txt', 'new contents for file a!'
      )
      .then((change) ->
        # assert it changed on disk
        t.equal(
          fs.readFileSync(path.join(tmpDir, 'a.txt')).toString(),
          'new contents for file a!',
          'Change got written to disk (syncMode: push)'
        )
        return
      )
      .then(->
        sinon.assert.calledOnce readySpy
        done()
      )
    ,

    # test with a syncDir in 'pull' mode
    (done) ->
      reset()
      folder = new VirtualFolder tmpDir, {syncMode: 'pull'}

      readySpy = sinon.spy()
      changeSpy = sinon.spy()
      folder.on 'ready', readySpy
      folder.on 'change', changeSpy

      # read something that got initially loaded
      folder.get('one/two/c.txt').then (contents) ->
        console.log 'using watchman?', folder._usingWatchman
        t.equal contents.toString(), 'file c\n', 'Can read initial loaded contents (pull mode)'
        t.ok changeSpy.notCalled, 'No change events yet (pull mode)'

        # change the file directly on disk
        fs.writeFileSync path.join(tmpDir, 'one/two/c.txt'), Buffer('oooo')

        # allow time for the fs watcher change event to fire
        setTimeout ->
          t.ok changeSpy.calledOnce, 'One change event after file changed on disk (pull mode)'

          # verify the info about this modification event
          change = changeSpy.firstCall.args[0]
          t.equal change.path, 'one/two/c.txt', 'change info includes path (pull mode)'
          t.equal change.type, 'modified', 'change info includes type (pull mode)'
          t.equal change.contents.toString(), 'oooo', 'change info includes new contents (pull mode)'
          t.equal change.oldContents.toString(), 'file c\n', 'change info includes new contents (pull mode)'
          t.ok (change instanceof VirtualFolder.ChangeInfo), 'change info object is correct type'

          # delete the file on disk
          fs.unlinkSync path.join(tmpDir, 'one/two/c.txt')

          # allow time for fs watcher deletion event to fire
          setTimeout ->
            t.ok changeSpy.calledTwice, 'Second change event has fired after deletion (pull mode)'

            # verify the info about this deletion event
            change2 = changeSpy.secondCall.args[0]
            t.equal change2.path, 'one/two/c.txt', 'change2 info includes path (pull mode)'
            t.equal change2.type, 'deleted', 'change info includes correct type (pull mode)'
            t.equal change2.contents, null, 'change info includes new contents (pull mode)'
            t.equal change2.oldContents.toString(), 'oooo', 'change info includes old contents (pull mode)'
            t.ok (change2 instanceof VirtualFolder.ChangeInfo), 'change info object is correct type'

            t.ok readySpy.calledOnce, 'Ready called once (pull mode)'

            folder.stop()
            done()
          , 500
        , 250

  ], (err) ->
    t.error err, 'No misc errors'
    t.end()
