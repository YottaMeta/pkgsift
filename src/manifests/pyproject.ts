import { parse as parseToml } from 'smol-toml';

import type { Dependency } from '../types.js';
import { findNameLine } from './lines.js';
import { normalizePypiName, parsePep508 } from './requirement.js';
import { asArray, asRecord, isRecord } from '../util/records.js';

type AddDependency = (name: string, versionRange?: string) => void;

export function parsePyprojectContent(content: string, source: string): Dependency[] {
  const document = parseTomlDocument(content);
  const dependencies: Dependency[] = [];
  const seen = new Set<string>();

  const add: AddDependency = (name, versionRange) => {
    const key = normalizePypiName(name);
    if (seen.has(key)) return;
    seen.add(key);
    dependencies.push({
      ecosystem: 'pypi',
      name,
      versionRange,
      source,
      line: findNameLine(content, name),
    });
  };

  const addSpec = (spec: unknown): void => {
    if (typeof spec !== 'string') return;
    const parsed = parsePep508(spec);
    if (parsed) add(parsed.name, parsed.versionRange);
  };

  const project = asRecord(document.project);
  for (const spec of asArray(project?.dependencies)) addSpec(spec);

  const optional = asRecord(project?.['optional-dependencies']);
  if (optional) {
    for (const group of Object.values(optional)) {
      for (const spec of asArray(group)) addSpec(spec);
    }
  }

  const groups = asRecord(document['dependency-groups']);
  if (groups) {
    const resolveGroup = (name: string, visiting: Set<string>): void => {
      if (visiting.has(name)) return;
      visiting.add(name);
      for (const entry of asArray(groups[name])) {
        if (typeof entry === 'string') {
          addSpec(entry);
        } else if (isRecord(entry) && typeof entry['include-group'] === 'string') {
          resolveGroup(entry['include-group'], visiting);
        }
      }
    };
    for (const name of Object.keys(groups)) resolveGroup(name, new Set());
  }

  const poetry = asRecord(asRecord(asRecord(document.tool)?.poetry));
  addPoetryDependencies(poetry?.dependencies, add);
  addPoetryDependencies(poetry?.['dev-dependencies'], add);

  const poetryGroups = asRecord(poetry?.group);
  if (poetryGroups) {
    for (const group of Object.values(poetryGroups)) {
      addPoetryDependencies(asRecord(group)?.dependencies, add);
    }
  }

  return dependencies;
}

function addPoetryDependencies(block: unknown, add: AddDependency): void {
  const dependencies = asRecord(block);
  if (!dependencies) return;

  for (const [name, entry] of Object.entries(dependencies)) {
    if (name === 'python') continue;
    if (typeof entry === 'string') {
      add(name, entry);
    } else if (isRecord(entry) && typeof entry.version === 'string') {
      add(name, entry.version);
    }
  }
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
