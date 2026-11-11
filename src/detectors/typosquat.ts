import removeConfusables from 'confusables';
import damerauLevenshtein from 'damerau-levenshtein';

import { thresholds } from '../config.js';
import popular from '../data/popular.json';
import { normalizePypiName } from '../manifests/requirement.js';
import type { Dependency, Ecosystem, Finding, LookupResult } from '../types.js';

const MIN_COMPARABLE_LENGTH = thresholds.typosquatMinNameLength;
const SCOPED_MIN_COMPARABLE_LENGTH = thresholds.scopedTyposquatMinNameLength;
const LONG_NAME_LENGTH = thresholds.typosquatLongNameLength;
const MAX_DISTANCE = thresholds.typosquatMaxDistance;
const VERSION_SUFFIX = /^-(?:v)?\d+$/;

const NPM_KNOWN = new Set(popular.npm);
const NPM_UNSCOPED_TARGETS = new Set<string>();
const NPM_SCOPED_TARGETS = new Map<string, Set<string>>();

for (const name of popular.npm.slice(0, popular.targetLimit)) {
  const slash = name.indexOf('/');
  if (!name.startsWith('@') || slash === -1) {
    NPM_UNSCOPED_TARGETS.add(name);
    continue;
  }

  const scope = name.slice(0, slash);
  const part = name.slice(slash + 1);
  const targets = NPM_SCOPED_TARGETS.get(scope);
  if (targets) targets.add(part);
  else NPM_SCOPED_TARGETS.set(scope, new Set([part]));
}

const PYPI_KNOWN = new Set(popular.pypi.map(normalizePypiName));
const PYPI_TARGETS = new Set(
  popular.pypi.slice(0, popular.targetLimit).map(normalizePypiName),
);

interface Match {
  name: string;
  distance: number;
}

export function detectTyposquat(dependency: Dependency, result: LookupResult): Finding | null {
  if (result.status !== 'found') return null;

  const normalized = normalizeName(dependency.ecosystem, dependency.name);

  const homoglyph = homoglyphTarget(dependency, normalized);
  if (homoglyph) {
    return {
      rule: 'PKG002',
      severity: 'block',
      confidence: 'high',
      ecosystem: dependency.ecosystem,
      package: dependency.name,
      versionRange: dependency.versionRange,
      source: dependency.source,
      line: dependency.line,
      message: `Package "${dependency.name}" uses look-alike characters and normalizes to popular package "${homoglyph}".`,
      evidence: { popularPackage: homoglyph },
      fix: `Did you mean "${homoglyph}"? Fix the manifest or verify the package source before installing.`,
    };
  }

  const match = closestPopular(dependency.ecosystem, normalized);
  if (!match) return null;

  return {
    rule: 'PKG002',
    severity: 'warn',
    confidence: 'medium',
    ecosystem: dependency.ecosystem,
    package: dependency.name,
    versionRange: dependency.versionRange,
    source: dependency.source,
    line: dependency.line,
    message: `Package "${dependency.name}" is ${match.distance} edit${
      match.distance === 1 ? '' : 's'
    } away from popular package "${match.name}".`,
    evidence: { popularPackage: match.name, distance: match.distance },
    fix: `Did you mean "${match.name}"? If this name came from generated code, correct the manifest; otherwise review the package source before installing.`,
  };
}

function normalizeName(ecosystem: Ecosystem, name: string): string {
  return ecosystem === 'pypi' ? normalizePypiName(name) : name.toLowerCase();
}

function closestPopular(ecosystem: Ecosystem, normalized: string): Match | null {
  if (ecosystem === 'pypi') {
    if (PYPI_KNOWN.has(normalized)) return null;
    return nearest(normalized, PYPI_TARGETS, MIN_COMPARABLE_LENGTH);
  }

  if (NPM_KNOWN.has(normalized)) return null;

  if (!normalized.startsWith('@')) {
    return nearest(normalized, NPM_UNSCOPED_TARGETS, MIN_COMPARABLE_LENGTH);
  }

  const slash = normalized.indexOf('/');
  if (slash <= 0) return null;

  const scope = normalized.slice(0, slash);
  const part = normalized.slice(slash + 1);
  const targets = NPM_SCOPED_TARGETS.get(scope);
  if (!targets) return null;

  const match = nearest(part, targets, SCOPED_MIN_COMPARABLE_LENGTH);
  return match ? { name: `${scope}/${match.name}`, distance: match.distance } : null;
}

function nearest(name: string, candidates: ReadonlySet<string>, minLength: number): Match | null {
  if (name.length < minLength) return null;

  const maxDistance = name.length >= LONG_NAME_LENGTH ? MAX_DISTANCE : 1;
  let best: Match | null = null;

  for (const candidate of candidates) {
    if (Math.abs(candidate.length - name.length) > maxDistance) continue;

    const distance = damerauLevenshtein(name, candidate).steps;
    if (distance === 0) return null;
    if (distance > maxDistance || isVersionedVariant(name, candidate)) continue;

    if (!best || distance < best.distance) {
      best = { name: candidate, distance };
      if (distance === 1) break;
    }
  }

  return best;
}

/** `http-proxy-3` and similar names are deliberate major-version forks, not typos. */
function isVersionedVariant(name: string, popularName: string): boolean {
  return name.startsWith(popularName) && VERSION_SUFFIX.test(name.slice(popularName.length));
}

function homoglyphTarget(dependency: Dependency, normalized: string): string | null {
  if (!/[^\x00-\x7f]/.test(dependency.name)) return null;

  const cleaned = normalizeName(dependency.ecosystem, removeConfusables(dependency.name));
  if (cleaned === normalized) return null;

  const known = dependency.ecosystem === 'pypi' ? PYPI_KNOWN : NPM_KNOWN;
  return known.has(cleaned) ? cleaned : null;
}
