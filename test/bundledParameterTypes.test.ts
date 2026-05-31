import { ExpressionBuilder, Source } from '@cucumber/language-service'
import { WasmParserAdapter } from '@cucumber/language-service/wasm'
import assert from 'assert'

import { bundledParameterTypes } from '../src/bundledParameterTypes.js'

describe('bundled parameter types', () => {
  it('parses Carmen Python step definitions without client-provided parameter types', async () => {
    const adapter = new WasmParserAdapter('node_modules/@cucumber/language-service/dist')
    await adapter.init()
    const builder = new ExpressionBuilder(adapter)
    const sources: readonly Source<'python'>[] = [
      {
        languageName: 'python',
        uri: 'file:///workspace/lib/python/carmtest/behave/steps/rave_steps.py',
        content: `
from behave import then

@then(u'rave "{rave_name}" shall be "{rave_value:MaybeString}"')
def check_rave_value(context, rave_name, rave_value):
    pass
`,
      },
    ]

    const result = builder.build(sources, bundledParameterTypes)

    assert.strictEqual(result.errors.length, 0)
    assert.strictEqual(result.expressionLinks.length, 1)
  })
})
