import { bundledParameterTypes } from './bundledParameterTypes.js'
import { ParameterTypeMeta, Settings } from './types.js'

export const gherkinLspStepsEnvVar = 'GHERKIN_LSP_STEPS'

const defaultFeatureGlobs = ['**/*.feature']
const defaultGlueGlobs = ['**/steps/**/*.py']

export function buildDefaultSettings(): Settings {
  return {
    features: defaultFeatureGlobs,
    glue: getDefaultGlueGlobs(),
    parameterTypes: bundledParameterTypes,
    snippetTemplates: {},
  }
}

export function getDefaultGlueGlobs(env = process.env): readonly string[] {
  const steps = env[gherkinLspStepsEnvVar]?.trim()
  if (!steps) return defaultGlueGlobs
  return [toPythonStepGlob(steps)]
}

function toPythonStepGlob(steps: string): string {
  if (steps.endsWith('.py') || containsGlobMagic(steps)) return steps
  return `${steps.replace(/[\\/]$/, '')}/**/*.py`
}

function containsGlobMagic(value: string): boolean {
  return /[*?[\]{}()!+@]/.test(value)
}

export function mergeParameterTypes(
  ...parameterTypeLists: readonly (readonly ParameterTypeMeta[] | undefined)[]
): readonly ParameterTypeMeta[] {
  const parameterTypesByName = new Map<string, ParameterTypeMeta>()
  for (const parameterTypeList of parameterTypeLists) {
    if (!parameterTypeList) continue
    for (const parameterType of parameterTypeList) {
      parameterTypesByName.set(parameterType.name, parameterType)
    }
  }
  return [...parameterTypesByName.values()]
}
