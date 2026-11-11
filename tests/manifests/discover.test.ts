import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverManifests } from '../../src/manifests/discover.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pkgsift-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(relativePath: string): Promise<void> {
  const fullPath = join(root, relativePath);
  await mkdir(join(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, '{}', 'utf8');
}

describe('discoverManifests', () => {
  it('finds supported manifests recursively', async () => {
    await write('package.json');
    await write('sub/pyproject.toml');

    await expect(discoverManifests(root)).resolves.toEqual(['package.json', 'sub/pyproject.toml']);
  });

  it('skips node_modules, virtualenvs, and hidden directories', async () => {
    await write('package.json');
    await write('node_modules/evil/package.json');
    await write('.venv/requirements.txt');
    await write('.git/package.json');
    await write('sub/node_modules/dep/requirements.txt');

    await expect(discoverManifests(root)).resolves.toEqual(['package.json']);
  });

  it('returns an empty list when nothing matches', async () => {
    await write('README.md');

    await expect(discoverManifests(root)).resolves.toEqual([]);
  });
});
