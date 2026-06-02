import assert from 'assert'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  CheckUsageError,
  formatCheckResult,
  inferCarmusrRoot,
  runCheck,
} from '../src/node/check.js'

describe('check command', () => {
  let rootPath: string
  let wasmBasePath: string

  beforeEach(async () => {
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gherkin-lsp-check-'))
    wasmBasePath = path.resolve('node_modules/@cucumber/language-service/dist')
    await fs.mkdir(path.join(rootPath, 'gherkin_features/PAIRING_BASE'), { recursive: true })
    await fs.mkdir(path.join(rootPath, 'lib/python/carmtest/behave/steps'), { recursive: true })
    await fs.writeFile(
      path.join(rootPath, 'lib/python/carmtest/behave/steps/example_steps.py'),
      [
        'from behave import given',
        '',
        '@given("I have {int} cukes")',
        'def step_impl(context, count):',
        '    pass',
        '',
      ].join('\n')
    )
  })

  afterEach(async () => {
    await fs.rm(rootPath, { recursive: true, force: true })
  })

  it('infers the Carmen root from a feature file under gherkin_features', async () => {
    const featureDir = path.join(rootPath, 'gherkin_features/PAIRING_BASE')

    assert.strictEqual(await inferCarmusrRoot(featureDir), rootPath)
  })

  it('uses Carmen step defaults and succeeds for a defined step', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/defined.feature')
    await fs.writeFile(
      featureFile,
      ['Feature: defined', '  Scenario: defined', '    Given I have 5 cukes', ''].join('\n')
    )

    const result = await runCheck({
      featureFile,
      format: 'text',
      failOn: 'error',
      wasmBasePath,
    })

    assert.strictEqual(result.failed, false)
    assert.deepStrictEqual(result.diagnostics, [])
    assert.deepStrictEqual(result.steps, ['lib/python/carmtest/behave/steps/**/*.py'])
    assert.strictEqual(formatCheckResult(result, 'text'), `${featureFile}: ok`)
  })

  it('does not fail on warnings by default', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/undefined.feature')
    await fs.writeFile(
      featureFile,
      ['Feature: undefined', '  Scenario: undefined', '    Given I have no matching step', ''].join(
        '\n'
      )
    )

    const result = await runCheck({
      featureFile,
      format: 'text',
      failOn: 'error',
      wasmBasePath,
    })

    assert.strictEqual(result.failed, false)
    assert.strictEqual(result.summary.warning, 1)
    assert.match(
      formatCheckResult(result, 'text'),
      /warning Undefined step: I have no matching step/
    )
  })

  it('fails on warnings when requested', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/undefined.feature')
    await fs.writeFile(
      featureFile,
      ['Feature: undefined', '  Scenario: undefined', '    Given I have no matching step', ''].join(
        '\n'
      )
    )

    const result = await runCheck({
      featureFile,
      format: 'text',
      failOn: 'warning',
      wasmBasePath,
    })

    assert.strictEqual(result.failed, true)
    assert.strictEqual(result.summary.warning, 1)
  })

  it('fails on Gherkin parser errors', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/malformed.feature')
    await fs.writeFile(
      featureFile,
      [
        'Feature: malformed',
        '  Scenario: malformed',
        '    Given I have 5 cukes',
        '    """',
        '',
      ].join('\n')
    )

    const result = await runCheck({
      featureFile,
      format: 'text',
      failOn: 'error',
      wasmBasePath,
    })

    assert.strictEqual(result.failed, true)
    assert.strictEqual(result.summary.error, 1)
  })

  it('expands a relative steps directory from the Carmen root', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/defined.feature')
    await fs.writeFile(
      featureFile,
      ['Feature: defined', '  Scenario: defined', '    Given I have 5 cukes', ''].join('\n')
    )

    const result = await runCheck({
      featureFile,
      steps: 'lib/python/carmtest/behave/steps',
      format: 'text',
      failOn: 'error',
      wasmBasePath,
    })

    assert.deepStrictEqual(result.steps, ['lib/python/carmtest/behave/steps/**/*.py'])
    assert.strictEqual(result.failed, false)
  })

  it('requires root or steps when the Carmen root cannot be inferred', async () => {
    const otherRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gherkin-lsp-check-other-'))
    try {
      const featureFile = path.join(otherRoot, 'example.feature')
      await fs.writeFile(featureFile, 'Feature: other\n')

      await assert.rejects(
        () =>
          runCheck({
            featureFile,
            format: 'text',
            failOn: 'error',
            wasmBasePath,
          }),
        CheckUsageError
      )
    } finally {
      await fs.rm(otherRoot, { recursive: true, force: true })
    }
  })

  it('emits parseable JSON output', async () => {
    const featureFile = path.join(rootPath, 'gherkin_features/PAIRING_BASE/defined.feature')
    await fs.writeFile(
      featureFile,
      ['Feature: defined', '  Scenario: defined', '    Given I have 5 cukes', ''].join('\n')
    )

    const result = await runCheck({
      featureFile,
      format: 'json',
      failOn: 'error',
      wasmBasePath,
    })
    const parsed = JSON.parse(formatCheckResult(result, 'json'))

    assert.strictEqual(parsed.file, featureFile)
    assert.strictEqual(parsed.summary.error, 0)
  })
})
