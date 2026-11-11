import type { Dependency, Finding, LookupResult } from '../types.js';

const REGISTRY_LABEL: Record<Dependency['ecosystem'], string> = {
  npm: 'npm',
  pypi: 'PyPI',
};

export function detectMissingPackage(dependency: Dependency, result: LookupResult): Finding | null {
  if (result.status !== 'missing') return null;

  return {
    rule: 'PKG001',
    severity: 'block',
    confidence: 'high',
    ecosystem: dependency.ecosystem,
    package: dependency.name,
    versionRange: dependency.versionRange,
    source: dependency.source,
    line: dependency.line,
    message: `Package "${dependency.name}" does not exist in the ${REGISTRY_LABEL[dependency.ecosystem]} registry.`,
    evidence: {
      registry: dependency.ecosystem,
      status: 404,
    },
    fix: 'Remove it, or replace it with the package you actually meant.',
  };
}
