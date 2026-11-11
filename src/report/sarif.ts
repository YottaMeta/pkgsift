import { createHash } from 'node:crypto';

import { thresholds } from '../config.js';
import type { Finding, ScanResult, Severity } from '../types.js';
import { VERSION } from '../version.js';

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

const RULES = [
  {
    id: 'PKG001',
    name: 'PackageDoesNotExist',
    shortDescription: { text: 'Dependency does not exist in the public registry' },
    fullDescription: {
      text: 'The package name is not present in npm or PyPI, which usually means it was hallucinated or has been removed.',
    },
    defaultConfiguration: { level: 'error' as const },
    properties: { tags: ['security', 'dependencies'], severity: 'block', confidence: 'high' },
  },
  {
    id: 'PKG002',
    name: 'TyposquattedName',
    shortDescription: { text: 'Package name closely resembles a popular package' },
    fullDescription: {
      text: `The name is within edit distance 1 of a top package (distance ${thresholds.typosquatMaxDistance} for names of ${thresholds.typosquatLongNameLength}+ characters), or becomes a popular name after removing look-alike characters.`,
    },
    defaultConfiguration: { level: 'warning' as const },
    properties: { tags: ['security', 'dependencies'], severity: 'warn', confidence: 'medium' },
  },
  {
    id: 'PKG003',
    name: 'NewlyPublishedPackage',
    shortDescription: { text: 'Package was published very recently' },
    fullDescription: {
      text: `The package was first published less than ${thresholds.newPackageMaxAgeDays} days ago and lacks a repository link or maintainer history.`,
    },
    defaultConfiguration: { level: 'warning' as const },
    properties: { tags: ['security', 'dependencies'], severity: 'warn', confidence: 'medium' },
  },
  {
    id: 'PKG004',
    name: 'InstallScripts',
    shortDescription: { text: 'Package runs install scripts' },
    fullDescription: {
      text: 'The package defines preinstall, install, or postinstall scripts, which execute during npm install.',
    },
    defaultConfiguration: { level: 'warning' as const },
    properties: { tags: ['security', 'dependencies'], severity: 'warn', confidence: 'medium' },
  },
];

const LEVELS: Record<Severity, 'error' | 'warning' | 'note'> = {
  block: 'error',
  warn: 'warning',
  info: 'note',
};

export function formatSarif(result: ScanResult): string {
  const ruleIndex = new Map(RULES.map((rule, index) => [rule.id, index]));

  const results = result.findings.map((finding) => ({
    ruleId: finding.rule,
    ruleIndex: ruleIndex.get(finding.rule) ?? 0,
    level: LEVELS[finding.severity],
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.source, uriBaseId: '%SRCROOT%' },
          ...(finding.line ? { region: { startLine: finding.line } } : {}),
        },
      },
    ],
    partialFingerprints: { pkgsiftFinding: fingerprint(finding) },
    properties: {
      confidence: finding.confidence,
      ecosystem: finding.ecosystem,
      package: finding.package,
      versionRange: finding.versionRange,
      evidence: finding.evidence,
    },
  }));

  const notifications = [
    ...result.unknown.map((check) => ({
      level: 'warning' as const,
      message: {
        text: `Could not check "${check.package}": ${check.reason}`,
      },
      locations: [
        { physicalLocation: { artifactLocation: { uri: check.source, uriBaseId: '%SRCROOT%' } } },
      ],
    })),
    ...result.errors.map((error) => ({
      level: 'error' as const,
      message: { text: `${error.source}: ${error.message}` },
      locations: [
        { physicalLocation: { artifactLocation: { uri: error.source, uriBaseId: '%SRCROOT%' } } },
      ],
    })),
  ];

  return JSON.stringify(
    {
      $schema: SARIF_SCHEMA,
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'PkgSift',
              informationUri: 'https://github.com/YottaMeta/pkgsift',
              version: VERSION,
              rules: RULES,
            },
          },
          invocations: [
            {
              executionSuccessful: result.errors.length === 0 && result.unknown.length === 0,
              toolExecutionNotifications: notifications,
            },
          ],
          results,
        },
      ],
    },
    null,
    2,
  );
}

function fingerprint(finding: Finding): string {
  return createHash('sha256')
    .update([finding.rule, finding.package, finding.source, finding.line ?? 0].join(':'))
    .digest('hex')
    .slice(0, 16);
}
