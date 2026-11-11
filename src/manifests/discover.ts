import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const MANIFEST_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  'target',
  '__pycache__',
]);

const MAX_DEPTH = 8;

export async function discoverManifests(root: string): Promise<string[]> {
  const found: string[] = [];
  await walk(root, root, 0, found);
  return found.sort();
}

async function walk(dir: string, root: string, depth: number, found: string[]): Promise<void> {
  if (depth > MAX_DEPTH) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walk(fullPath, root, depth + 1, found);
      continue;
    }

    if (entry.isFile() && MANIFEST_FILES.has(entry.name)) {
      found.push(toPosix(relativeTo(root, fullPath)));
    }
  }
}

function relativeTo(root: string, fullPath: string): string {
  return fullPath.slice(root.length).replace(/^[/\\]/, '');
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}
