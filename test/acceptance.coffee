require('source-map-support').install()

test = require 'tape'
path = require 'path'
wrench = require 'wrench'
fs = require 'fs'
async = require 'async'
VirtualFolder = require '..'
sinon = require 'sinon'

fixtureDir = path.join __dirname, 'fixture'
tmpDir = path.join __dirname, 'tmp'

# function to prepare a tmp dir to experiment with, run before each test
reset = ->
  if fs.existsSync tmpDir
    wrench.rmdirSyncRecursive tmpDir
  wrench.copyDirSyncRecursive fixtureDir, tmpDir


test 'virtual-folder', (t) ->

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

          sinon.assert.calledOnce readySpy
          sinon.assert.calledTwice changeSpy

          done()

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
        # validate the change object TODO
        console.log 'CHANGED!', change

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

    # test with a syncDir in 'pull' mode
    # TODO

  ], (err) ->
    t.error err, 'No misc errors'
    t.end()
