import { readFile } from 'node:fs/promises';

import type { Dependency } from '../types.js';

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

interface Range {
  start: number;
  end: number;
}

export async function parseNpmManifest(source: string, filePath: string): Promise<Dependency[]> {
  const content = await readFile(filePath, 'utf8');
  return parsePackageJson(content, source);
}

export function parsePackageJson(rawContent: string, source: string): Dependency[] {
  const content = rawContent.replace(/^\uFEFF/, '');
  const pkg: unknown = JSON.parse(content);
  if (!isRecord(pkg)) {
    throw new Error('package.json is not a JSON object');
  }

  const dependencies: Dependency[] = [];
  const seen = new Set<string>();

  for (const section of SECTIONS) {
    const block = pkg[section];
    if (!isRecord(block)) continue;
    const range = findSectionRange(content, section);

    for (const [name, versionRange] of Object.entries(block)) {
      if (typeof versionRange !== 'string' || seen.has(name)) continue;
      seen.add(name);
      dependencies.push({
        ecosystem: 'npm',
        name,
        versionRange,
        source,
        line: range ? lineOfKey(content, name, range) : undefined,
      });
    }
  }

  return dependencies;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findSectionRange(content: string, section: string): Range | null {
  const key = JSON.stringify(section);
  const keyIndex = content.indexOf(key);
  if (keyIndex === -1) return null;

  const open = content.indexOf('{', keyIndex + key.length);
  if (open === -1) return null;

  let depth = 0;
  for (let i = open; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"') {
      i = skipString(content, i);
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start: open, end: i };
    }
  }

  return null;
}

function skipString(content: string, start: number): number {
  for (let i = start + 1; i < content.length; i += 1) {
    if (content[i] === '\\') {
      i += 1;
      continue;
    }
    if (content[i] === '"') return i;
  }
  return content.length - 1;
}

function lineOfKey(content: string, name: string, range: Range): number | undefined {
  const needle = JSON.stringify(name);
  const index = content.indexOf(needle, range.start);
  if (index === -1 || index > range.end) return undefined;

  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}
