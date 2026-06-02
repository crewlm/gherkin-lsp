import assert from 'assert'

import { runCli } from '../src/node/cli.js'

describe('CLI', () => {
  it('prints help without starting the language server', async () => {
    let output = ''
    let started = false

    const exitCode = await runCli({
      argv: ['--help'],
      wasmBasePath: '/unused',
      stdout: {
        write: (chunk: string) => {
          output += chunk
          return true
        },
      },
      startStdio: () => {
        started = true
        return { connection: { console: { error: () => undefined } } }
      },
    })

    assert.strictEqual(exitCode, 0)
    assert.strictEqual(started, false)
    assert.match(output, /Usage:/)
    assert.match(output, /gherkin-lsp --stdio/)
    assert.match(output, /gherkin-lsp check <feature-file>/)
  })
})
