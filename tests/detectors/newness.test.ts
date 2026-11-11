import { describe, expect, it } from 'vitest';

import { detectNewPackage } from '../../src/detectors/newness.js';
import type { Dependency, LookupResult } from '../../src/types.js';

const now = new Date('2026-11-11T00:00:00.000Z');

const dependency: Dependency = {
  ecosystem: 'npm',
  name: 'react-codeshift',
  versionRange: '^1.0.0',
  source: 'package.json',
  line: 12,
};

function found(metadata: {
  firstPublishedAt?: string;
  repository?: string;
  maintainerCount?: number;
}): LookupResult {
  return { status: 'found', metadata: { installScripts: [], ...metadata } };
}

describe('detectNewPackage (PKG003)', () => {
  it('warns about a new package without a repository link', () => {
    const finding = detectNewPackage(
      dependency,
      found({ firstPublishedAt: '2026-11-01T00:00:00.000Z' }),
      { now },
    );

    expect(finding).toMatchObject({
      rule: 'PKG003',
      severity: 'warn',
      confidence: 'medium',
      package: 'react-codeshift',
      source: 'package.json',
      line: 12,
    });
    expect(finding?.message).toContain('10 days ago');
    expect(finding?.message).toContain('no repository link');
    expect(finding?.evidence).toMatchObject({ ageDays: 10, repository: null });
  });

  it('warns when a new package has a single maintainer but a repository', () => {
    const finding = detectNewPackage(
      dependency,
      found({
        firstPublishedAt: '2026-11-09T00:00:00.000Z',
        repository: 'https://github.com/example/react-codeshift',
        maintainerCount: 1,
      }),
      { now },
    );

    expect(finding?.message).toContain('2 days ago');
    expect(finding?.message).toContain('a single maintainer');
    expect(finding?.evidence).toMatchObject({ maintainerCount: 1 });
  });

  it('stays quiet for old packages', () => {
    const finding = detectNewPackage(
      dependency,
      found({ firstPublishedAt: '2020-01-01T00:00:00.000Z' }),
      { now },
    );

    expect(finding).toBeNull();
  });

  it('stays quiet when a new package has a repository and several maintainers', () => {
    const finding = detectNewPackage(
      dependency,
      found({
        firstPublishedAt: '2026-11-01T00:00:00.000Z',
        repository: 'https://github.com/example/react-codeshift',
        maintainerCount: 4,
      }),
      { now },
    );

    expect(finding).toBeNull();
  });

  it('trusts well-known npm scopes', () => {
    const finding = detectNewPackage(
      { ...dependency, name: '@types/react-codeshift' },
      found({ firstPublishedAt: '2026-11-10T00:00:00.000Z' }),
      { now },
    );

    expect(finding).toBeNull();
  });

  it('checks PyPI packages without maintainer metadata', () => {
    const finding = detectNewPackage(
      { ...dependency, ecosystem: 'pypi', name: 'requests-next' },
      found({ firstPublishedAt: '2026-11-06T00:00:00.000Z' }),
      { now },
    );

    expect(finding).toMatchObject({ rule: 'PKG003', ecosystem: 'pypi' });
  });

  it('ignores unparseable timestamps and non-found results', () => {
    expect(
      detectNewPackage(dependency, found({ firstPublishedAt: 'not-a-date' }), { now }),
    ).toBeNull();
    expect(
      detectNewPackage(dependency, found({ firstPublishedAt: '2026-12-01T00:00:00.000Z' }), {
        now,
      }),
    ).toBeNull();
    expect(detectNewPackage(dependency, { status: 'unknown', reason: 'timeout' }, { now })).toBeNull();
    expect(detectNewPackage(dependency, { status: 'missing' }, { now })).toBeNull();
  });
});
