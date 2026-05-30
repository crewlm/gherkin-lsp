import assert from 'assert'

import { buildDefaultSettings, getDefaultGlueGlobs } from '../src/defaultSettings.js'

describe('default settings', () => {
  it('finds all feature files and step files by default', () => {
    const settings = buildDefaultSettings()

    assert.deepStrictEqual(settings.features, ['**/*.feature'])
    assert.deepStrictEqual(settings.glue, ['**/steps/**/*.py'])
  })

  it('uses GHERKIN_LSP_STEPS as a step directory', () => {
    const glue = getDefaultGlueGlobs({
      GHERKIN_LSP_STEPS: '/workspace/lib/python/carmtest/behave/steps',
    })

    assert.deepStrictEqual(glue, ['/workspace/lib/python/carmtest/behave/steps/**/*.py'])
  })

  it('uses GHERKIN_LSP_STEPS as a step glob', () => {
    const glue = getDefaultGlueGlobs({
      GHERKIN_LSP_STEPS: '/workspace/lib/python/carmtest/behave/steps/**/*.py',
    })

    assert.deepStrictEqual(glue, ['/workspace/lib/python/carmtest/behave/steps/**/*.py'])
  })
})
