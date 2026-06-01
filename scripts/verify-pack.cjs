#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync, spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(args, options = {}) {
  console.log(`$ npm ${args.join(' ')}`)
  return execFileSync(npm, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  })
}

function parsePackJson(output) {
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse npm pack JSON output:\n${output}`)
  }

  return JSON.parse(output.slice(start, end + 1))
}

function waitForInitializeResponse(binPath, installDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, ['--stdio'], {
      cwd: installDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`Timed out waiting for initialize response. stderr:\n${stderr}`))
    }, 5000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (stdout.includes('"id":1')) {
        clearTimeout(timeout)
        child.kill()
        resolve()
      }
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('exit', (code) => {
      if (!stdout.includes('"id":1')) {
        clearTimeout(timeout)
        reject(new Error(`LSP exited before initialize response with code ${code}. stderr:\n${stderr}`))
      }
    })

    const initialize = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        rootUri: `file://${installDir}`,
        capabilities: {},
        workspaceFolders: null,
      },
    })

    child.stdin.write(`Content-Length: ${Buffer.byteLength(initialize, 'utf8')}\r\n\r\n${initialize}`)
  })
}

async function main() {
  run(['pack', '--dry-run'])

  const packOutput = run(['pack', '--json'])
  const [{ filename }] = parsePackJson(packOutput)
  const tarball = path.resolve(root, filename)
  let installDir

  try {
    installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gherkin-lsp-pack-'))
    fs.writeFileSync(path.join(installDir, 'package.json'), '{"private":true}\n')

    const installArgs = [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--prefer-online',
      tarball,
    ]

    console.log(`$ npm ${installArgs.join(' ')}`)
    execFileSync(npm, installArgs, {
      cwd: installDir,
      stdio: 'inherit',
      timeout: 120000,
    })

    const binPath = path.join(
      installDir,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'gherkin-lsp.cmd' : 'gherkin-lsp'
    )

    if (!fs.existsSync(binPath)) {
      throw new Error(`Expected binary was not installed: ${binPath}`)
    }

    await waitForInitializeResponse(binPath, installDir)
    console.log('Package tarball verification passed.')
  } finally {
    fs.rmSync(tarball, { force: true })
    if (installDir) {
      fs.rmSync(installDir, { recursive: true, force: true })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
