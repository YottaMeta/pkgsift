# PkgSift

[![npm version](https://img.shields.io/npm/v/@yottameta/pkgsift.svg)](https://www.npmjs.com/package/@yottameta/pkgsift)
[![CI](https://github.com/YottaMeta/pkgsift/actions/workflows/ci.yml/badge.svg)](https://github.com/YottaMeta/pkgsift/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**English** | [简体中文](README.zh-CN.md)

**Sift before you install.**

PkgSift checks dependency manifests for packages that do not exist, names that look like typosquats, brand-new packages, and install-time scripts — using only public registry metadata. It runs before `npm install` / `pip install`, so hallucinated and slopsquatted dependencies never reach your lockfile.

No LLM, no package download, no code execution. Deterministic rules and public metadata only.

## Rules

| Rule | What it catches | Default |
| --- | --- | --- |
| PKG001 | Package does not exist in the registry (hallucinated or removed) | block |
| PKG002 | Name is 1–2 edits from a top-3000 package, or becomes one after removing look-alike characters; numeric version forks (`http-proxy-3`) are ignored | warn (block for look-alike characters) |
| PKG003 | First published < 30 days ago and has no repository link or maintainer history | warn |
| PKG004 | Defines `preinstall`, `install`, or `postinstall` scripts (common packages allowlisted) | warn |

Manifests scanned: `package.json`, `requirements.txt` (including `-r`), `pyproject.toml` (PEP 621, optional dependencies, dependency groups, Poetry), `Pipfile`.

Dependencies that do not resolve through a public registry (`file:`, `link:`, `workspace:`, `git+`, direct URLs, npm aliases) are skipped rather than reported — a false block is worse than a missing check.

## Quick start

```bash
# Scan the current directory
npx @yottameta/pkgsift scan .

# Scan a specific project and fail CI on warnings too
npx @yottameta/pkgsift scan ./app --fail-on warn
```

No install is needed first: PkgSift only reads manifests, then queries the registry. Scan before installing:

```bash
npx @yottameta/pkgsift scan . && npm install
```

A non-zero exit code means do not install yet. Fix the manifest, then rerun.

Install it once per repo (the command stays `pkgsift`):

```bash
npm install --save-dev @yottameta/pkgsift
```

```json
{
  "scripts": {
    "deps:sift": "pkgsift scan . --fail-on block"
  }
}
```

## Output formats

```bash
pkgsift scan .                          # human-readable report
pkgsift scan . --format json            # machine-readable report (--json also works)
pkgsift scan . --format markdown        # ready for a PR comment
pkgsift scan . --format sarif > out.sarif
```

| Exit code | Meaning |
| --- | --- |
| 0 | No blocking findings |
| 1 | Findings at or above `--fail-on` (default `block`) |
| 2 | Scan incomplete (network failures, unreadable manifests) or invalid arguments |

An incomplete scan is never reported as a pass.

## GitHub Action

```yaml
name: PkgSift

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YottaMeta/pkgsift@action-v1
        with:
          path: .
          fail-on: block
```

The action writes the Markdown report to the job summary and creates or updates a PR comment. Fork PRs receive a read-only token, so the comment step is skipped; the scan still fails on blocking findings.

### SARIF upload

```yaml
- run: npx @yottameta/pkgsift scan . --format sarif --fail-on block > pkgsift.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: pkgsift.sarif
```

SARIF upload to a private repository requires GitHub Code Security; the SARIF file itself can also be consumed by any SARIF-capable viewer.

## Configuration

| Environment variable | Purpose |
| --- | --- |
| `PKGSIFT_NPM_REGISTRY` | npm registry base URL (default `https://registry.npmjs.org`) |
| `PKGSIFT_PYPI_REGISTRY` | PyPI base URL (default `https://pypi.org`) |
| `PKGSIFT_CACHE_DIR` | Metadata cache directory (default `~/.cache/pkgsift`, 24h TTL) |

Use `--no-cache` to bypass the cache. Registry overrides also make offline testing possible.

## How the baselines work

- npm: [LeoDog896/npm-rank](https://github.com/LeoDog896/npm-rank), ranked by download count and deduplicated. The top 3000 are typosquat targets; the rest are treated as established packages and never flagged.
- PyPI: [hugovk/top-pypi-packages](https://github.com/hugovk/top-pypi-packages), 30-day downloads, filtered to >100k. The top 3000 are targets; the rest are exclusions.

The baseline ships inside the package; no network calls are made to build it at scan time. Regenerate it with maintained public sources (or local files when GitHub is unreachable):

```bash
npm run data:popular
node scripts/build-popular.mjs --npm-rank ./raw.json --pypi-top ./top-pypi.json
```

This only rewrites `src/data/popular.json`.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
node dist/cli.js scan .
```

## Limitations

- npm alias targets (`npm:real-package@1`) are not resolved yet.
- Lockfiles are not scanned; PkgSift inspects declared manifests.
- Only npm and PyPI are supported in this version.
- Thresholds are currently fixed in `src/config.ts`; a `.pkgsiftrc.json` override is planned.

## License

The CLI and detection rules in this repository are open source under the [Apache License 2.0](LICENSE). Bundled third-party components and baseline data keep their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Planned commercial offerings (hosted monitoring for private repositories, threat-intel feeds, organization features) will live in separate, separately licensed components.
