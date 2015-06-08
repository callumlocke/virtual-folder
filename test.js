var fs = require('fs');
console.log('TRAVIS');

var multiform = require('multiform');

console.log('__dirname', __dirname);
console.log('contents:', fs.readdirSync(__dirname));


var dir = multiform.select();
console.log('dir', dir);

console.log('contents:', fs.readdirSync(dir));

module.exports = multiform.load('test.js');
