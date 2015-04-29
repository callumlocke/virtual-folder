'use strict';

import path from 'path';
import chalk from 'chalk';
import Promise from 'bluebird';
import clearTrace from 'clear-trace';
// import sourceMapSupport from 'source-map-support';

// make errors more informative
// sourceMapSupport.install();
Promise.longStackTraces();

const glob = Promise.promisify(require('glob'));
const cwd = process.cwd();

const MAX_TIME_ALL_TESTS = 10000;


/**
 * Preparation: handle errors and exiting
 */

let numErrors = 0;
const handleError = function (err) {
  numErrors++;
  // todo: if error is an assertion, pretty-print the assertion details
  console.log(clearTrace(err));
};

const exit = function (code) {
  if (numErrors) {
    console.log('\n' + chalk.red('✘'), numErrors, 'error' + (numErrors > 1 ? 's' : '') + '.\n\n');
    process.exit(1); // eslint-disable-line
  }
  else {
    console.log('\n' + chalk.green('✔'), 'No errors.\n\n');
  }
  console.log('Exiting with code', code);
};

process.on('exit', exit);
process.on('uncaughtException', function (err) {
  console.error('UNCAUGHT EXCEPTION');
  handleError(err);
  process.exit(1); // eslint-disable-line
});
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('UNHANDLED REJECTION at promise'), promise);
  handleError(reason);
  process.exit(1); // eslint-disable-line
});



/**
 * Load and run all the test scripts in series.
 */

Promise.resolve(async function allTests() {
  for (let filename of await glob('**/*.js', {cwd: __dirname})) {
    if (path.basename(filename).charAt(0) === '_') continue;

    filename = path.join(__dirname, filename);
    console.log(chalk.cyan('\nTEST:'), chalk.gray(path.relative(cwd, filename)));

    const test = require(filename);

    // run the test, handling any sync or async errors
    try {
      await Promise.resolve(test()).catch(handleError);
    }
    catch (err) {
      handleError(err);
    }
  }
}()).timeout(MAX_TIME_ALL_TESTS).catch(handleError);
