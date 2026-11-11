#!/usr/bin/env node
// Builds THIRD_PARTY_NOTICES.md for runtime dependencies bundled into dist/cli.js.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(ROOT, 'THIRD_PARTY_NOTICES.md');

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const dependencies = Object.keys(pkg.dependencies ?? {}).sort();

const sections = [
  '# Third-party notices',
  '',
  'PkgSift bundles the following runtime dependencies into `dist/cli.js`.',
  'Each package remains under its own license.',
  '',
];

for (const name of dependencies) {
  const directory = join(ROOT, 'node_modules', name);
  const meta = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const files = await readdir(directory);
  const licenseFile = files.find((file) => /^(licen[cs]e|copying)/i.test(file));
  const licenseText = licenseFile
    ? (await readFile(join(directory, licenseFile), 'utf8')).trim()
    : 'No license file was included in the published package.';

  sections.push(`## ${name}`, '');
  sections.push(`License: ${meta.license ?? 'unknown'}`);
  const repository =
    typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
  if (repository) sections.push(`Repository: ${repository}`);
  sections.push('', '```text', licenseText, '```', '');
}

sections.push(
  '## Data sources',
  '',
  '- npm ranking: LeoDog896/npm-rank (https://github.com/LeoDog896/npm-rank), ranked by download count.',
  '- PyPI ranking: hugovk/top-pypi-packages (https://github.com/hugovk/top-pypi-packages), 30-day download counts.',
  '',
);

await writeFile(OUTPUT, `${sections.join('\n')}\n`, 'utf8');
console.log(`wrote ${OUTPUT} for ${dependencies.length} dependencies`);
