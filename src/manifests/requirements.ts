import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { Dependency } from '../types.js';
import { normalizePypiName, parsePep508 } from './requirement.js';

const INCLUDE_RE = /^(?:-r|--requirement)\b\s*(.+)$/;
const SKIP_FLAG_RE = /^(?:-c|--constraint|-i|--index-url|--extra-index-url|-f|--find-links|--trusted-host|--no-binary|--only-binary|--require-hashes|--pre|--prefer-binary)\b/;
const EDITABLE_RE = /^(?:-e|--editable)\b/;

interface LogicalLine {
  text: string;
  line: number;
}

/**
 * Parses requirements.txt content. `-r/--requirement` includes are ignored here;
 * use parseRequirementsFile when includes need to be followed.
 */
export function parseRequirementsContent(content: string, source: string): Dependency[] {
  const dependencies: Dependency[] = [];

  for (const { text, line } of logicalLines(content)) {
    const dependency = toDependency(text, source, line);
    if (dependency) dependencies.push(dependency);
  }

  return dedupe(dependencies);
}

export async function parseRequirementsFile(source: string, filePath: string): Promise<Dependency[]> {
  const seen = new Set<string>();
  const dependencies: Dependency[] = [];
  await collectRequirements(resolve(filePath), source, dependencies, seen, 0);
  return dedupe(dependencies);
}

async function collectRequirements(
  absolutePath: string,
  source: string,
  dependencies: Dependency[],
  seen: Set<string>,
  depth: number,
): Promise<void> {
  if (depth > 4 || seen.has(absolutePath)) return;
  seen.add(absolutePath);

  const content = await readFile(absolutePath, 'utf8');

  for (const { text, line } of logicalLines(content)) {
    const include = INCLUDE_RE.exec(text.trim());
    if (include) {
      const includeName = stripQuotes(include[1] ?? '').replace(/\\/g, '/');
      if (!includeName) continue;
      await collectRequirements(
        resolve(dirname(absolutePath), includeName),
        joinSource(source, includeName),
        dependencies,
        seen,
        depth + 1,
      );
      continue;
    }

    const dependency = toDependency(text, source, line);
    if (dependency) dependencies.push(dependency);
  }
}

function toDependency(text: string, source: string, line: number): Dependency | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (SKIP_FLAG_RE.test(trimmed) || EDITABLE_RE.test(trimmed)) return null;

  const parsed = parsePep508(trimmed);
  if (!parsed) return null;

  return {
    ecosystem: 'pypi',
    name: parsed.name,
    versionRange: parsed.versionRange,
    source,
    line,
  };
}

function logicalLines(content: string): LogicalLine[] {
  const raw = content.split(/\r?\n/);
  const result: LogicalLine[] = [];
  let buffer = '';
  let startLine = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const rawLine = raw[index] ?? '';
    if (buffer === '') startLine = index + 1;
    buffer += buffer === '' ? rawLine : ` ${rawLine.trim()}`;

    const trimmedEnd = buffer.trimEnd();
    if (trimmedEnd.endsWith('\\')) {
      buffer = trimmedEnd.slice(0, -1);
      continue;
    }

    if (buffer.trim() !== '') result.push({ text: buffer, line: startLine });
    buffer = '';
  }

  if (buffer.trim() !== '') result.push({ text: buffer, line: startLine });

  return result;
}

function dedupe(dependencies: Dependency[]): Dependency[] {
  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = normalizePypiName(dependency.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function joinSource(source: string, includeName: string): string {
  const dir = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
  const name = includeName.replace(/^\.\//, '');
  return dir ? `${dir}/${name}` : name;
}
