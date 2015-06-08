var fs = require('fs');
console.log('TRAVIS');

var multiform = require('multiform');

var dir = multiform.select();
console.log('dir', dir);

console.log('contents:', fs.readdirSync(dir));

module.exports = multiform.load('test.js');
