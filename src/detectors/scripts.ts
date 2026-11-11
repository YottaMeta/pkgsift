import type { Dependency, Finding, LookupResult } from '../types.js';

const ALLOWLIST = new Set([
  '@biomejs/biome',
  '@parcel/watcher',
  '@prisma/client',
  '@prisma/engines',
  '@swc/core',
  'better-sqlite3',
  'bcrypt',
  'bufferutil',
  'canvas',
  'core-js',
  'cypress',
  'dtrace-provider',
  'electron',
  'esbuild',
  'fsevents',
  'husky',
  'keytar',
  'lightningcss',
  'msgpackr-extract',
  'node-gyp',
  'node-pre-gyp',
  'node-sass',
  'onnxruntime-node',
  'phantomjs-prebuilt',
  'playwright',
  'playwright-chromium',
  'playwright-core',
  'playwright-firefox',
  'playwright-webkit',
  'protobufjs',
  'prisma',
  'puppeteer',
  'puppeteer-core',
  're2',
  'sass',
  'sharp',
  'simple-git-hooks',
  'sqlite3',
  'unix-dgram',
  'utf-8-validate',
]);

export function detectInstallScripts(dependency: Dependency, result: LookupResult): Finding | null {
  if (dependency.ecosystem !== 'npm' || result.status !== 'found') return null;

  const scripts = result.metadata.installScripts;
  if (scripts.length === 0) return null;
  if (ALLOWLIST.has(dependency.name.toLowerCase())) return null;

  return {
    rule: 'PKG004',
    severity: 'warn',
    confidence: 'medium',
    ecosystem: dependency.ecosystem,
    package: dependency.name,
    versionRange: dependency.versionRange,
    source: dependency.source,
    line: dependency.line,
    message: `Package runs install scripts (${scripts.join(', ')}).`,
    evidence: { scripts },
    fix: 'Review the install scripts or pin a version you trust before installing.',
  };
}
