import { parse as parseToml } from 'smol-toml';

import type { Dependency } from '../types.js';
import { findNameLine } from './lines.js';
import { normalizePypiName } from './requirement.js';
import { asRecord, isRecord } from '../util/records.js';

const SECTIONS = ['packages', 'dev-packages'] as const;
const NON_REGISTRY_SOURCES = ['git', 'path', 'file', 'url'] as const;

export function parsePipfileContent(content: string, source: string): Dependency[] {
  const document = parseTomlDocument(content);
  const dependencies: Dependency[] = [];
  const seen = new Set<string>();

  for (const section of SECTIONS) {
    const block = asRecord(document[section]);
    if (!block) continue;

    for (const [name, entry] of Object.entries(block)) {
      const key = normalizePypiName(name);
      if (seen.has(key)) continue;

      const versionRange = versionOf(entry);
      if (versionRange === null) continue;

      seen.add(key);
      dependencies.push({
        ecosystem: 'pypi',
        name,
        versionRange,
        source,
        line: findNameLine(content, name),
      });
    }
  }

  return dependencies;
}

function versionOf(entry: unknown): string | undefined | null {
  if (typeof entry === 'string') return entry;
  if (!isRecord(entry)) return undefined;

  if (NON_REGISTRY_SOURCES.some((field) => typeof entry[field] === 'string')) return null;
  if (typeof entry.version === 'string') return entry.version;
  return undefined;
}

function parseTomlDocument(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = parseToml(content);
    if (!isRecord(parsed)) throw new Error('root is not a table');
    return parsed;
  } catch (error) {
    throw new Error(`Invalid TOML: ${error instanceof Error ? error.message : String(error)}`);
  }
}
