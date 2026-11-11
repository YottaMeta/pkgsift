import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { detectMissingPackage } from './detectors/exists.js';
import { detectNewPackage } from './detectors/newness.js';
import { detectInstallScripts } from './detectors/scripts.js';
import { detectTyposquat } from './detectors/typosquat.js';
import { discoverManifests } from './manifests/discover.js';
import { parseNpmManifest } from './manifests/npm.js';
import { parsePipfileContent } from './manifests/pipfile.js';
import { parsePyprojectContent } from './manifests/pyproject.js';
import { parseRequirementsFile } from './manifests/requirements.js';
import { lookupPackages, registryKey } from './registries/index.js';
import type {
  Dependency,
  Finding,
  ScanError,
  ScanOptions,
  ScanResult,
  UnknownCheck,
} from './types.js';

const NON_REGISTRY_NPM_RANGE = /^(?:file:|link:|workspace:|git\+|git:|https?:|github:|npm:)/i;
const NON_REGISTRY_PYPI_RANGE = /^(?:@|git\+|https?:\/\/|file:)/i;
const SEVERITY_ORDER = { block: 0, warn: 1, info: 2 } as const;

export function isRegistryResolvable(dependency: Dependency): boolean {
  const range = dependency.versionRange?.trim() ?? '';
  return dependency.ecosystem === 'npm'
    ? !NON_REGISTRY_NPM_RANGE.test(range)
    : !NON_REGISTRY_PYPI_RANGE.test(range);
}

export async function scanDirectory(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const absoluteRoot = resolve(root);
  const manifests = await discoverManifests(absoluteRoot);
  const dependencies: Dependency[] = [];
  const errors: ScanError[] = [];

  for (const source of manifests) {
    try {
      const filePath = join(absoluteRoot, source);

      if (source.endsWith('package.json')) {
        dependencies.push(...(await parseNpmManifest(source, filePath)));
      } else if (source.endsWith('requirements.txt')) {
        dependencies.push(...(await parseRequirementsFile(source, filePath)));
      } else if (source.endsWith('pyproject.toml')) {
        dependencies.push(...parsePyprojectContent(await readFile(filePath, 'utf8'), source));
      } else if (source.endsWith('Pipfile')) {
        dependencies.push(...parsePipfileContent(await readFile(filePath, 'utf8'), source));
      }
    } catch (error) {
      errors.push({
        source,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const candidates = dependencies.filter(isRegistryResolvable);
  const lookups = await lookupPackages(candidates, {
    cache: options.cache,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
  });

  const findings: Finding[] = [];
  const unknown = new Map<string, UnknownCheck>();

  for (const dependency of candidates) {
    const key = registryKey(dependency.ecosystem, dependency.name);
    const result = lookups.get(key);
    if (!result) continue;

    if (result.status === 'unknown') {
      if (!unknown.has(key)) {
        unknown.set(key, {
          ecosystem: dependency.ecosystem,
          package: dependency.name,
          source: dependency.source,
          reason: result.reason,
        });
      }
      continue;
    }

    const missing = detectMissingPackage(dependency, result);
    if (missing) findings.push(missing);

    const typosquat = detectTyposquat(dependency, result);
    if (typosquat) findings.push(typosquat);

    const newPackage = detectNewPackage(dependency, result, { now: options.now });
    if (newPackage) findings.push(newPackage);

    const scripts = detectInstallScripts(dependency, result);
    if (scripts) findings.push(scripts);
  }

  findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.package.localeCompare(b.package),
  );

  return {
    root: absoluteRoot,
    manifests,
    dependencies,
    findings,
    unknown: [...unknown.values()],
    errors,
  };
}
