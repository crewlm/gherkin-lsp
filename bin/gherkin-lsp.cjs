#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('source-map-support').install()
const { startStandaloneServer } = require('../dist/cjs/src/wasm/startStandaloneServer')
const { defaultWasmBasePath, runCli } = require('../dist/cjs/src/node/cli')

runCli({
  argv: process.argv.slice(2),
  wasmBasePath: defaultWasmBasePath(__dirname),
  startStdio: startStandaloneServer,
}).then((exitCode) => {
  if (typeof exitCode === 'number') process.exitCode = exitCode
})
