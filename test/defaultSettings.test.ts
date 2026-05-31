import assert from 'assert'

import { bundledParameterTypes } from '../src/bundledParameterTypes.js'
import { buildDefaultSettings, getDefaultGlueGlobs } from '../src/defaultSettings.js'
import { mergeParameterTypes } from '../src/defaultSettings.js'

describe('default settings', () => {
  it('finds all feature files and step files by default', () => {
    const settings = buildDefaultSettings()

    assert.deepStrictEqual(settings.features, ['**/*.feature'])
    assert.deepStrictEqual(settings.glue, ['**/steps/**/*.py'])
    assert.deepStrictEqual(settings.parameterTypes, bundledParameterTypes)
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

  it('adds configured parameter types without losing bundled ones', () => {
    const merged = mergeParameterTypes(bundledParameterTypes, [
      { name: 'custom_type', regexp: 'custom' },
    ])

    assert.strictEqual(merged.length, bundledParameterTypes.length + 1)
    assert.deepStrictEqual(merged[merged.length - 1], { name: 'custom_type', regexp: 'custom' })
  })

  it('lets configured parameter types override bundled ones by name', () => {
    const merged = mergeParameterTypes(bundledParameterTypes, [
      { name: 'MaybeString', regexp: 'override' },
    ])

    assert.strictEqual(merged.length, bundledParameterTypes.length)
    assert.deepStrictEqual(
      merged.find((parameterType) => parameterType.name === 'MaybeString'),
      { name: 'MaybeString', regexp: 'override' }
    )
  })

  it('dedupes duplicate configured parameter types by name', () => {
    const merged = mergeParameterTypes(
      [{ name: 'custom_type', regexp: 'first' }],
      [{ name: 'custom_type', regexp: 'second' }]
    )

    assert.deepStrictEqual(merged, [{ name: 'custom_type', regexp: 'second' }])
  })
})
