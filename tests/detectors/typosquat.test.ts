import { describe, expect, it } from 'vitest';

import { detectTyposquat } from '../../src/detectors/typosquat.js';
import type { Dependency, LookupResult } from '../../src/types.js';

const found: LookupResult = { status: 'found', metadata: { installScripts: [] } };

function dependency(name: string, ecosystem: Dependency['ecosystem'] = 'npm'): Dependency {
  return { ecosystem, name, versionRange: '^1.0.0', source: 'package.json', line: 7 };
}

describe('detectTyposquat (PKG002)', () => {
  it('stays quiet for popular packages themselves', () => {
    expect(detectTyposquat(dependency('lodash'), found)).toBeNull();
    expect(detectTyposquat(dependency('@types/node'), found)).toBeNull();
    expect(detectTyposquat(dependency('requests', 'pypi'), found)).toBeNull();
  });

  it('flags a one-edit typo of a popular package', () => {
    const finding = detectTyposquat(dependency('lodas'), found);

    expect(finding).toMatchObject({
      rule: 'PKG002',
      severity: 'warn',
      confidence: 'medium',
      package: 'lodas',
      source: 'package.json',
      line: 7,
    });
    expect(finding?.evidence).toMatchObject({ popularPackage: 'lodash', distance: 1 });
    expect(finding?.message).toContain('lodash');
  });

  it('catches transposed characters', () => {
    const finding = detectTyposquat(dependency('axois'), found);

    expect(finding?.evidence).toMatchObject({ popularPackage: 'axios', distance: 1 });
  });

  it('allows two edits for long names', () => {
    const finding = detectTyposquat(dependency('reacr-don'), found);

    expect(finding?.evidence).toMatchObject({ popularPackage: 'react-dom', distance: 2 });
  });

  it('checks scoped packages only against the same scope', () => {
    expect(detectTyposquat(dependency('@types/nod'), found)?.evidence).toMatchObject({
      popularPackage: '@types/node',
    });
    expect(detectTyposquat(dependency('@example/express'), found)).toBeNull();
    expect(detectTyposquat(dependency('@types/less'), found)).toBeNull();
  });

  it('ignores short names', () => {
    expect(detectTyposquat(dependency('mss'), found)).toBeNull();
  });

  it('ignores established packages outside the target list', () => {
    expect(detectTyposquat(dependency('clipboard'), found)).toBeNull();
  });

  it('ignores deliberate version forks', () => {
    expect(detectTyposquat(dependency('http-proxy-3'), found)).toBeNull();
  });

  it('blocks look-alike characters', () => {
    const finding = detectTyposquat(dependency('lоdash'), found);

    expect(finding).toMatchObject({ rule: 'PKG002', severity: 'block', confidence: 'high' });
    expect(finding?.evidence).toMatchObject({ popularPackage: 'lodash' });
  });

  it('normalizes PyPI names before comparing', () => {
    const finding = detectTyposquat(dependency('Reqeusts', 'pypi'), found);

    expect(finding?.evidence).toMatchObject({ popularPackage: 'requests' });
  });

  it('stays quiet when the package is missing or unknown', () => {
    expect(detectTyposquat(dependency('lodas'), { status: 'missing' })).toBeNull();
    expect(detectTyposquat(dependency('lodas'), { status: 'unknown', reason: 'timeout' })).toBeNull();
  });
});
