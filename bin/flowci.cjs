#!/usr/bin/env node

// Local-dev friendly launcher: ships TS sources and runs them via ts-node.
// This keeps `flowci` usable immediately after `npm i -D ./flowci` in any repo.

const path = require('node:path');

try {
  // Force CommonJS transpilation regardless of the host repo config.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('ts-node').register({
    project: path.join(__dirname, '..', 'tsconfig.json'),
    transpileOnly: true,
    compilerOptions: { module: 'Node16', moduleResolution: 'Node16' }
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('flowci: missing ts-node. Reinstall flowci or add ts-node/typescript to dependencies.');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../src/cli/main.ts');
