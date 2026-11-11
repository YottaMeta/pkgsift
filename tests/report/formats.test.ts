import { describe, expect, it } from 'vitest';

import { formatMarkdown } from '../../src/report/markdown.js';
import { formatSarif } from '../../src/report/sarif.js';
import type { ScanResult } from '../../src/types.js';

const result: ScanResult = {
  root: '/repo',
  manifests: ['package.json', 'requirements.txt'],
  dependencies: [
    { ecosystem: 'npm', name: 'react-codeshift', source: 'package.json', line: 12 },
    { ecosystem: 'npm', name: 'lodas', source: 'package.json', line: 13 },
    { ecosystem: 'pypi', name: 'reqeusts', source: 'requirements.txt' },
  ],
  findings: [
    {
      rule: 'PKG001',
      severity: 'block',
      confidence: 'high',
      ecosystem: 'npm',
      package: 'react-codeshift',
      versionRange: '^1.0.0',
      source: 'package.json',
      line: 12,
      message: 'Package "react-codeshift" does not exist in the npm registry.',
      evidence: { status: 404 },
      fix: 'Remove it.',
    },
    {
      rule: 'PKG002',
      severity: 'warn',
      confidence: 'medium',
      ecosystem: 'npm',
      package: 'lodas',
      versionRange: '^1.0.0',
      source: 'package.json',
      line: 13,
      message: 'Package "lodas" is 1 edit away from popular package "lodash".',
      evidence: { popularPackage: 'lodash', distance: 1 },
      fix: 'Did you mean "lodash"?',
    },
  ],
  unknown: [
    { ecosystem: 'pypi', package: 'reqeusts', source: 'requirements.txt', reason: 'timeout' },
  ],
  errors: [{ source: 'pyproject.toml', message: 'invalid TOML' }],
};

describe('formatMarkdown', () => {
  it('renders findings grouped by severity with locations and a status', () => {
    const output = formatMarkdown(result);

    expect(output).toContain('## PkgSift report');
    expect(output).toContain('**1 block**, **1 warn**, **0 info**, **1 unknown**');
    expect(output).toContain('### Blocking (1)');
    expect(output).toContain('### Warnings (1)');
    expect(output).not.toContain('### Notes');
    expect(output).toContain('`react-codeshift@^1.0.0`');
    expect(output).toContain('`package.json:12`');
    expect(output).toContain('### Incomplete checks (1)');
    expect(output).toContain('### Errors (1)');
    expect(output).toContain('> **Scan incomplete — this is not a pass.**');
    expect(output).toContain('_Thresholds:');
  });

  it('reports a clean scan as a pass', () => {
    const clean: ScanResult = {
      ...result,
      findings: [],
      unknown: [],
      errors: [],
    };

    expect(formatMarkdown(clean)).toContain('> No issues found.');
  });
});

describe('formatSarif', () => {
  it('produces a SARIF 2.1.0 run with rule metadata and results', () => {
    const sarif = JSON.parse(formatSarif(result));
    const run = sarif.runs[0];

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(run.tool.driver).toMatchObject({ name: 'PkgSift' });
    expect(run.tool.driver.rules).toHaveLength(4);
    expect(run.results).toHaveLength(2);

    expect(run.results[0]).toMatchObject({
      ruleId: 'PKG001',
      ruleIndex: 0,
      level: 'error',
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: 'package.json', uriBaseId: '%SRCROOT%' },
            region: { startLine: 12 },
          },
        },
      ],
    });
    expect(run.results[1]).toMatchObject({ ruleId: 'PKG002', ruleIndex: 1, level: 'warning' });
    expect(run.results[0].partialFingerprints.pkgsiftFinding).toMatch(/^[0-9a-f]{16}$/);
  });

  it('marks the run incomplete when checks failed', () => {
    const sarif = JSON.parse(formatSarif(result));
    const invocation = sarif.runs[0].invocations[0];

    expect(invocation.executionSuccessful).toBe(false);
    expect(invocation.toolExecutionNotifications).toHaveLength(2);
    expect(invocation.toolExecutionNotifications[0]).toMatchObject({ level: 'warning' });
    expect(invocation.toolExecutionNotifications[1]).toMatchObject({ level: 'error' });
  });

  it('keeps fingerprints stable across runs', () => {
    const first = JSON.parse(formatSarif(result));
    const second = JSON.parse(formatSarif(result));

    expect(first.runs[0].results[0].partialFingerprints).toEqual(
      second.runs[0].results[0].partialFingerprints,
    );
  });
});
