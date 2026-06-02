import path from 'path'

import { version } from '../version.js'
import { CheckFormat, CheckUsageError, FailOn, formatCheckResult, runCheck } from './check.js'
import { NodeFiles } from './NodeFiles.js'

type StdioStarter = (
  wasmBasePath: string,
  makeFiles: (rootUri: string) => NodeFiles
) => {
  connection: {
    console: {
      error(message: string): void
    }
  }
}

type CliOptions = {
  argv: readonly string[]
  wasmBasePath: string
  startStdio: StdioStarter
  stdout?: Pick<NodeJS.WriteStream, 'write'>
  stderr?: Pick<NodeJS.WriteStream, 'write'>
}

export async function runCli(options: CliOptions): Promise<number | undefined> {
  const stdout = options.stdout || process.stdout
  const stderr = options.stderr || process.stderr
  const args = options.argv.slice()

  if (args.length === 0 || args.includes('--stdio')) {
    const { connection } = options.startStdio(
      options.wasmBasePath,
      (rootUri) => new NodeFiles(rootUri)
    )
    process.on('unhandledRejection', (reason, p) => {
      connection.console.error(
        `Gherkin LSP ${version}: Unhandled Rejection at promise: ${p}, reason: ${reason}`
      )
    })
    return undefined
  }

  const command = args.shift()
  if (command !== 'check') {
    stderr.write(`Unknown command: ${command}\n${usage()}\n`)
    return 2
  }

  try {
    const checkOptions = parseCheckArgs(args, options.wasmBasePath)
    const result = await runCheck(checkOptions)
    stdout.write(`${formatCheckResult(result, checkOptions.format)}\n`)
    return result.failed ? 1 : 0
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    stderr.write(`${message}\n`)
    if (err instanceof CheckUsageError) {
      stderr.write(`${usage()}\n`)
      return 2
    }
    return 1
  }
}

function parseCheckArgs(args: readonly string[], wasmBasePath: string) {
  let root: string | undefined
  let steps: string | undefined
  let format: CheckFormat = 'text'
  let failOn: FailOn = 'error'
  let featureFile: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    switch (arg) {
      case '--root':
        root = readOptionValue(args, ++i, '--root')
        break
      case '--steps':
        steps = readOptionValue(args, ++i, '--steps')
        break
      case '--format':
        format = parseFormat(readOptionValue(args, ++i, '--format'))
        break
      case '--fail-on':
        failOn = parseFailOn(readOptionValue(args, ++i, '--fail-on'))
        break
      default:
        if (arg.startsWith('--')) throw new CheckUsageError(`Unknown option: ${arg}`)
        if (featureFile) throw new CheckUsageError(`Unexpected argument: ${arg}`)
        featureFile = arg
    }
  }

  if (!featureFile) throw new CheckUsageError('Missing feature file')

  return {
    featureFile,
    root,
    steps,
    format,
    failOn,
    wasmBasePath,
  }
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index]
  if (!value || value.startsWith('--')) throw new CheckUsageError(`Missing value for ${option}`)
  return value
}

function parseFormat(value: string): CheckFormat {
  if (value === 'text' || value === 'json') return value
  throw new CheckUsageError(`Invalid --format value: ${value}`)
}

function parseFailOn(value: string): FailOn {
  if (value === 'error' || value === 'warning') return value
  throw new CheckUsageError(`Invalid --fail-on value: ${value}`)
}

function usage(): string {
  return [
    'Usage:',
    '  gherkin-lsp --stdio',
    '  gherkin-lsp check <feature-file> [--root <path>] [--steps <glob-or-dir>] [--format text|json] [--fail-on error|warning]',
  ].join('\n')
}

export function defaultWasmBasePath(binDir: string): string {
  return path.resolve(`${binDir}/../node_modules/@cucumber/language-service/dist`)
}
