#!/usr/bin/env node
// Regenerates src/data/popular.json from maintained public rankings.
// Usage: node scripts/build-popular.mjs [--limit 10000] [--npm-rank <file-or-url>] [--pypi-top <file-or-url>]
//
// Sources:
// - npm: LeoDog896/npm-rank (https://github.com/LeoDog896/npm-rank), ranked by downloads.
// - PyPI: hugovk/top-pypi-packages (https://github.com/hugovk/top-pypi-packages), 30-day downloads.
//
// The first `targetLimit` entries in each list are typosquat targets; the
// remaining entries are only used to exclude established packages from matching.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'src', 'data', 'popular.json');
const LIMIT_INDEX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_INDEX === -1 ? 10000 : Number(process.argv[LIMIT_INDEX + 1]);
const TARGET_LIMIT = 3000;
const MIN_MONTHLY_DOWNLOADS = 100_000;
const USER_AGENT = 'pkgsift-baseline-builder';

if (!Number.isInteger(LIMIT) || LIMIT <= 0) {
  console.error('--limit must be a positive integer');
  process.exit(1);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function loadJson(source) {
  return /^https?:\/\//i.test(source) ? fetchJson(source) : JSON.parse(await readFile(source, 'utf8'));
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const NPM_RANK_SOURCE =
  argValue('--npm-rank') ??
  'https://github.com/LeoDog896/npm-rank/releases/download/latest/raw.json';
const PYPI_TOP_SOURCE =
  argValue('--pypi-top') ??
  'https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json';

const [npmRank, pypiTop] = await Promise.all([
  loadJson(NPM_RANK_SOURCE),
  loadJson(PYPI_TOP_SOURCE),
]);

const npm = [...new Set(npmRank.map((entry) => entry?.name).filter(Boolean))].slice(0, LIMIT);
const pypi = [...new Set(
  pypiTop.rows
    .filter((row) => row.download_count >= MIN_MONTHLY_DOWNLOADS)
    .map((row) => row.project)
    .filter(Boolean),
)].slice(0, LIMIT);

if (npm.length === 0 || pypi.length === 0) {
  throw new Error('a ranking source returned no packages; refusing to overwrite the baseline');
}

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      limit: LIMIT,
      targetLimit: TARGET_LIMIT,
      minMonthlyDownloads: MIN_MONTHLY_DOWNLOADS,
      sources: {
        npm: 'https://github.com/LeoDog896/npm-rank (ranked by downloads)',
        pypi: 'https://github.com/hugovk/top-pypi-packages (30-day downloads)',
      },
      npm,
      pypi,
    },
    null,
    0,
  )}\n`,
  'utf8',
);

console.log(
  `wrote ${OUTPUT}: npm ${npm.length} (scoped ${npm.filter((name) => name.startsWith('@')).length}), pypi ${pypi.length}`,
);
