import {
  CucumberExpressions,
  ExpressionBuilder,
  getGherkinDiagnostics,
  LanguageName,
  ParameterTypeMeta,
  Source,
} from '@cucumber/language-service'
import { WasmParserAdapter } from '@cucumber/language-service/wasm'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types'

import { buildDefaultSettings } from '../defaultSettings.js'
import { loadGlueSources } from '../fs.js'
import { NodeFiles } from './NodeFiles.js'

export type CheckFormat = 'text' | 'json'
export type FailOn = 'error' | 'warning'

export type CheckOptions = {
  featureFile: string
  root?: string
  steps?: string
  format: CheckFormat
  failOn: FailOn
  wasmBasePath: string
  cwd?: string
}

export type NormalizedDiagnostic = Diagnostic & {
  severityName: 'error' | 'warning' | 'information' | 'hint' | 'unknown'
}

export type CheckResult = {
  file: string
  root: string | null
  steps: readonly string[]
  diagnostics: readonly NormalizedDiagnostic[]
  summary: {
    error: number
    warning: number
    information: number
    hint: number
    unknown: number
  }
  failed: boolean
}

const defaultStepGlob = 'lib/python/carmtest/behave/steps/**/*.py'

export class CheckUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckUsageError'
  }
}

export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const cwd = options.cwd || process.cwd()
  const file = path.resolve(cwd, options.featureFile)
  await assertFeatureFile(file)

  const root = options.root
    ? path.resolve(cwd, options.root)
    : await inferCarmusrRoot(path.dirname(file))
  if (!root && !options.steps) {
    throw new CheckUsageError(
      'Could not infer Carmen root. Pass --root or --steps to locate step definitions.'
    )
  }

  const effectiveRoot = root || path.dirname(file)
  const steps = [await normalizeStepGlob(options.steps || defaultStepGlob, effectiveRoot)]
  const files = new NodeFiles(url.pathToFileURL(effectiveRoot).href)
  const glueSources = await loadGlueSources(files, steps)
  const expressions = await buildExpressions(options.wasmBasePath, glueSources)
  const content = await fs.readFile(file, 'utf-8')
  const diagnostics = getGherkinDiagnostics(content, expressions).map(normalizeDiagnostic)
  const summary = summarizeDiagnostics(diagnostics)

  return {
    file,
    root,
    steps,
    diagnostics,
    summary,
    failed: shouldFail(diagnostics, options.failOn),
  }
}

export function formatCheckResult(result: CheckResult, format: CheckFormat): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2)
  }

  if (result.diagnostics.length === 0) {
    return `${result.file}: ok`
  }

  return result.diagnostics
    .map((diagnostic) => formatTextDiagnostic(result.file, diagnostic))
    .join('\n')
}

export async function inferCarmusrRoot(startDir: string): Promise<string | null> {
  let dir = path.resolve(startDir)
  for (;;) {
    if (await hasCarmenLayout(dir)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

async function assertFeatureFile(file: string) {
  if (path.extname(file) !== '.feature') {
    throw new CheckUsageError(`Expected a .feature file, got ${file}`)
  }
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) {
      throw new CheckUsageError(`Feature path is not a file: ${file}`)
    }
  } catch (err) {
    if (err instanceof CheckUsageError) throw err
    throw new CheckUsageError(`Feature file not found: ${file}`)
  }
}

async function hasCarmenLayout(dir: string): Promise<boolean> {
  const [features, steps] = await Promise.all([
    isDirectory(path.join(dir, 'gherkin_features')),
    isDirectory(path.join(dir, 'lib/python/carmtest/behave/steps')),
  ])
  return features && steps
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory()
  } catch {
    return false
  }
}

async function normalizeStepGlob(steps: string, root: string): Promise<string> {
  if (containsGlobMagic(steps)) return steps
  const absolutePath = path.isAbsolute(steps) ? steps : path.resolve(root, steps)
  const glob = path.isAbsolute(steps) ? absolutePath : steps
  if (await isDirectory(absolutePath)) return `${trimTrailingSlash(glob)}/**/*.py`
  if (path.extname(steps) === '.py') return glob
  return `${trimTrailingSlash(glob)}/**/*.py`
}

function trimTrailingSlash(value: string): string {
  return value.replace(/[\\/]+$/, '')
}

function containsGlobMagic(value: string): boolean {
  return /[*?[\]{}()!+@]/.test(value)
}

async function buildExpressions(
  wasmBasePath: string,
  glueSources: readonly Source<LanguageName>[]
): Promise<readonly CucumberExpressions.Expression[]> {
  const adapter = new WasmParserAdapter(wasmBasePath)
  await adapter.init()
  const builder = new ExpressionBuilder(adapter)
  const parameterTypes = buildDefaultSettings().parameterTypes as readonly ParameterTypeMeta[]
  return builder.build(glueSources, parameterTypes).expressionLinks.map((link) => link.expression)
}

function normalizeDiagnostic(diagnostic: Diagnostic): NormalizedDiagnostic {
  return {
    ...diagnostic,
    severityName: severityName(diagnostic.severity),
  }
}

function severityName(
  severity: DiagnosticSeverity | undefined
): NormalizedDiagnostic['severityName'] {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'error'
    case DiagnosticSeverity.Warning:
      return 'warning'
    case DiagnosticSeverity.Information:
      return 'information'
    case DiagnosticSeverity.Hint:
      return 'hint'
    default:
      return 'unknown'
  }
}

function summarizeDiagnostics(
  diagnostics: readonly NormalizedDiagnostic[]
): CheckResult['summary'] {
  return diagnostics.reduce<CheckResult['summary']>(
    (summary, diagnostic) => {
      summary[diagnostic.severityName] += 1
      return summary
    },
    {
      error: 0,
      warning: 0,
      information: 0,
      hint: 0,
      unknown: 0,
    }
  )
}

function shouldFail(diagnostics: readonly NormalizedDiagnostic[], failOn: FailOn): boolean {
  return diagnostics.some((diagnostic) => {
    if (diagnostic.severityName === 'error') return true
    return failOn === 'warning' && diagnostic.severityName === 'warning'
  })
}

function formatTextDiagnostic(file: string, diagnostic: NormalizedDiagnostic): string {
  const line = diagnostic.range.start.line + 1
  const column = diagnostic.range.start.character + 1
  return `${file}:${line}:${column} ${diagnostic.severityName} ${diagnostic.message}`
}
