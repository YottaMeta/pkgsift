import pLimit from 'p-limit';

import { FileCache } from '../cache/store.js';
import { normalizePypiName } from '../manifests/requirement.js';
import type { Dependency, Ecosystem, LookupResult } from '../types.js';
import { lookupNpmPackage } from './npm.js';
import { lookupPypiPackage } from './pypi.js';

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 120_000;

export type LookupMap = Map<string, LookupResult>;

export interface LookupOptions {
  cache?: boolean;
  concurrency?: number;
  timeoutMs?: number;
}

export function registryKey(ecosystem: Ecosystem, name: string): string {
  return ecosystem === 'pypi' ? `pypi:${normalizePypiName(name)}` : `npm:${name}`;
}

export async function lookupPackages(
  dependencies: Dependency[],
  options: LookupOptions = {},
): Promise<LookupMap> {
  const cache = options.cache === false ? undefined : new FileCache();
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const unique = new Map<string, Dependency>();
  for (const dependency of dependencies) {
    const key = registryKey(dependency.ecosystem, dependency.name);
    if (!unique.has(key)) unique.set(key, dependency);
  }

  const results: LookupMap = new Map();

  await Promise.all(
    [...unique.entries()].map(([key, dependency]) =>
      limit(async () => {
        if (Date.now() > deadline) {
          results.set(key, { status: 'unknown', reason: 'scan timed out' });
          return;
        }

        if (cache) {
          const cached = await cache.get<LookupResult>(key);
          if (cached) {
            results.set(key, cached);
            return;
          }
        }

        const result =
          dependency.ecosystem === 'npm'
            ? await lookupNpmPackage(dependency.name)
            : await lookupPypiPackage(dependency.name);

        if (result.status !== 'unknown' && cache) await cache.set(key, result);
        results.set(key, result);
      }),
    ),
  );

  return results;
}
