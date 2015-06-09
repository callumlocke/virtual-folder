
var fs = require('fs');
var path = require('path');


console.log('__dirname', __dirname);
console.log('contents:', fs.readdirSync(__dirname));

console.log('\n\n');

var dist1 = path.resolve(__dirname, 'dist-1');

console.log(dist1);
console.log('contents:');
console.log(fs.readdirSync(dist1));
