import { thresholds } from '../config.js';
import type { Dependency, Finding, LookupResult } from '../types.js';

export interface NewnessOptions {
  now?: Date;
  maxAgeDays?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_DAYS = thresholds.newPackageMaxAgeDays;

/** Registries and organisations that routinely publish brand-new packages. */
const TRUSTED_NPM_SCOPES = new Set([
  '@angular',
  '@anthropic-ai',
  '@aws-sdk',
  '@azure',
  '@babel',
  '@biomejs',
  '@clerk',
  '@emotion',
  '@esbuild',
  '@floating-ui',
  '@google-cloud',
  '@headlessui',
  '@modelcontextprotocol',
  '@mui',
  '@npmcli',
  '@openai',
  '@opentelemetry',
  '@parcel',
  '@playwright',
  '@pnpm',
  '@prisma',
  '@radix-ui',
  '@reduxjs',
  '@rollup',
  '@sentry',
  '@storybook',
  '@supabase',
  '@sveltejs',
  '@swc',
  '@tailwindcss',
  '@tanstack',
  '@testing-library',
  '@trpc',
  '@types',
  '@vercel',
  '@vitejs',
  '@vue',
]);

export function detectNewPackage(
  dependency: Dependency,
  result: LookupResult,
  options: NewnessOptions = {},
): Finding | null {
  if (result.status !== 'found') return null;

  const publishedAt = result.metadata.firstPublishedAt;
  const createdAt = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  if (!Number.isFinite(createdAt)) return null;
  if (isTrustedName(dependency)) return null;

  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const ageDays = ((options.now ?? new Date()).getTime() - createdAt) / MS_PER_DAY;
  if (ageDays < 0 || ageDays >= maxAgeDays) return null;

  const repository = result.metadata.repository;
  const maintainerCount = result.metadata.maintainerCount;
  const noRepository = !repository;
  const singleMaintainer = maintainerCount !== undefined && maintainerCount <= 1;
  if (!noRepository && !singleMaintainer) return null;

  const signals = [
    noRepository ? 'no repository link' : undefined,
    singleMaintainer ? 'a single maintainer' : undefined,
  ].filter((signal): signal is string => signal !== undefined);

  return {
    rule: 'PKG003',
    severity: 'warn',
    confidence: 'medium',
    ecosystem: dependency.ecosystem,
    package: dependency.name,
    versionRange: dependency.versionRange,
    source: dependency.source,
    line: dependency.line,
    message: `Package "${dependency.name}" was first published ${formatAge(ageDays)} ago with ${joinSignals(signals)}.`,
    evidence: {
      firstPublishedAt: publishedAt,
      ageDays: Math.round(ageDays * 10) / 10,
      repository: repository ?? null,
      maintainerCount: maintainerCount ?? null,
    },
    fix: 'Confirm the package source before installing; prefer a maintained alternative if the name is unfamiliar.',
  };
}

function isTrustedName(dependency: Dependency): boolean {
  if (dependency.ecosystem !== 'npm') return false;
  const scope = dependency.name.split('/')[0];
  return scope !== undefined && TRUSTED_NPM_SCOPES.has(scope.toLowerCase());
}

function formatAge(ageDays: number): string {
  if (ageDays < 1) return 'less than a day';
  const days = Math.floor(ageDays);
  return days === 1 ? '1 day' : `${days} days`;
}

function joinSignals(signals: string[]): string {
  if (signals.length <= 1) return signals[0] ?? 'no verifiable history';
  return `${signals.slice(0, -1).join(' and ')} and ${signals[signals.length - 1]}`;
}
