import assert from 'assert'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import url from 'url'

import { NodeFiles } from '../src/node/NodeFiles.js'

describe('NodeFiles', () => {
  let rootPath: string

  beforeEach(async () => {
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gherkin-lsp-node-files-'))
    await fs.mkdir(path.join(rootPath, 'gherkin_features'), { recursive: true })
    await fs.mkdir(path.join(rootPath, 'lib/python/carmtest/behave/steps'), { recursive: true })
    await fs.mkdir(path.join(rootPath, 'node_modules/pkg'), { recursive: true })
    await fs.writeFile(path.join(rootPath, 'gherkin_features/example.feature'), 'Feature: test\n')
    await fs.writeFile(
      path.join(rootPath, 'lib/python/carmtest/behave/steps/example_steps.py'),
      'from behave import given\n'
    )
    await fs.writeFile(
      path.join(rootPath, 'node_modules/pkg/ignored.feature'),
      'Feature: ignored\n'
    )
  })

  afterEach(async () => {
    await fs.rm(rootPath, { recursive: true, force: true })
  })

  it('resolves relative glob results against the language-server root URI', async () => {
    const files = new NodeFiles(url.pathToFileURL(rootPath).href)
    const cwd = process.cwd()
    process.chdir(os.tmpdir())
    try {
      const uris = await files.findUris('**/steps/**/*.py')

      assert.deepStrictEqual(uris, [
        url.pathToFileURL(path.join(rootPath, 'lib/python/carmtest/behave/steps/example_steps.py'))
          .href,
      ])
    } finally {
      process.chdir(cwd)
    }
  })

  it('finds feature files while ignoring dependency directories', async () => {
    const files = new NodeFiles(url.pathToFileURL(rootPath).href)

    const uris = await files.findUris('**/*.feature')

    assert.deepStrictEqual(uris, [
      url.pathToFileURL(path.join(rootPath, 'gherkin_features/example.feature')).href,
    ])
  })

  it('supports absolute globs outside of process cwd', async () => {
    const files = new NodeFiles(url.pathToFileURL(rootPath).href)
    const cwd = process.cwd()
    process.chdir(os.tmpdir())
    try {
      const uris = await files.findUris(`${rootPath}/lib/python/carmtest/behave/steps/**/*.py`)

      assert.deepStrictEqual(uris, [
        url.pathToFileURL(path.join(rootPath, 'lib/python/carmtest/behave/steps/example_steps.py'))
          .href,
      ])
    } finally {
      process.chdir(cwd)
    }
  })
})
