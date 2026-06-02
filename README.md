<h1 align="center">
  <img src="https://raw.githubusercontent.com/cucumber/cucumber-js/46a5a78107be27e99c6e044c69b6e8f885ce456c/docs/images/logo.svg" alt="Cucumber logo" width="75">
  <br>
  Gherkin LSP
</h1>
<p align="center">
  <b>A <a href="https://langserver.org/">Language Server</a> for Gherkin feature files and Python Behave steps</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@crewlm/gherkin-lsp">
    <img src="https://img.shields.io/npm/v/@crewlm/gherkin-lsp.svg?color=dark-green" alt="npm">
  </a>
</p>

Provides Gherkin diagnostics, completion, formatting, and step-definition navigation for
editors that support the Language Server Protocol (LSP).

## Features

This is a focused fork of the Cucumber language server. It defaults to:

- all `**/*.feature` files in the editor workspace
- all Python step definitions matching `**/steps/**/*.py`

## Install

Run the server directly with `npx` or `bunx`:

```console
npx @crewlm/gherkin-lsp --stdio
bunx @crewlm/gherkin-lsp --stdio
```

The executable exposed by the package is `gherkin-lsp`.

## CLI check

Check one feature file from a Carmen `carmusr` checkout:

```console
gherkin-lsp check gherkin_features/PAIRING_BASE/trip.feature
```

For the standard Carmen layout, the command infers the `carmusr` root from the feature
path and loads step definitions from:

```text
lib/python/carmtest/behave/steps/**/*.py
```

Override discovery when needed:

```console
gherkin-lsp check path/to/file.feature \
  --root /path/to/carmusr \
  --steps 'lib/python/carmtest/behave/steps/**/*.py' \
  --format text \
  --fail-on error
```

Options:

- `--root <path>` overrides the inferred `carmusr` root.
- `--steps <glob-or-dir>` overrides the default step-definition location. Relative
  paths are resolved from the inferred or explicit root.
- `--format text|json` defaults to `text`.
- `--fail-on error|warning` defaults to `error`; undefined steps are warnings.

### Settings

The LSP client can provide settings to the server, but the server provides zero-config
defaults if the client does not provide them.

For layouts like this:

```text
carmusr/
  gherkin_features/**/*.feature
  lib/python/carmtest/behave/steps/**/*.py
```

the default `**/*.feature` and `**/steps/**/*.py` globs work when the workspace root is
`carmusr`.

If the editor workspace root is somewhere else, point the server at the steps directory
explicitly:

```console
GHERKIN_LSP_STEPS=/path/to/carmusr/lib/python/carmtest/behave/steps npx @crewlm/gherkin-lsp --stdio
```

`GHERKIN_LSP_STEPS` also accepts a glob:

```console
GHERKIN_LSP_STEPS=/path/to/carmusr/lib/python/carmtest/behave/steps/**/*.py npx @crewlm/gherkin-lsp --stdio
```

The server retrieves `cucumber.*` settings from the client with a [workspace/configuration](https://microsoft.github.io/language-server-protocol/specification#workspace_configuration) request.

See [Settings](src/types.ts) for details about the expected format.
