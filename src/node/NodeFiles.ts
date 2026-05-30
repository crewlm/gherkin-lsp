import fg from 'fast-glob'
import fs from 'fs/promises'
import { isAbsolute, relative, resolve } from 'path'
import url from 'url'

import { Files } from '../Files.js'

const ignoredDirectories = [
  '**/.git/**',
  '**/.hg/**',
  '**/.svn/**',
  '**/.venv/**',
  '**/__pycache__/**',
  '**/coverage/**',
  '**/dist/**',
  '**/node_modules/**',
]

export class NodeFiles implements Files {
  constructor(private readonly rootUri: string) {}

  async exists(uri: string): Promise<boolean> {
    try {
      await fs.stat(new URL(uri))
      return true
    } catch {
      return false
    }
  }

  readFile(uri: string): Promise<string> {
    const path = url.fileURLToPath(uri)
    return fs.readFile(path, 'utf-8')
  }

  async findUris(glob: string): Promise<readonly string[]> {
    const cwd = url.fileURLToPath(this.rootUri)
    const paths = await fg(glob, {
      cwd,
      caseSensitiveMatch: false,
      ignore: ignoredDirectories,
      onlyFiles: true,
    })
    return paths.map((path) => url.pathToFileURL(isAbsolute(path) ? path : resolve(cwd, path)).href)
  }

  relativePath(uri: string): string {
    return relative(new URL(this.rootUri).pathname, new URL(uri).pathname)
  }
}
