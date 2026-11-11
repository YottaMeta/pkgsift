import { describe, expect, it } from 'vitest';

import { detectMissingPackage } from '../../src/detectors/exists.js';
import type { Dependency } from '../../src/types.js';

const dependency: Dependency = {
  ecosystem: 'npm',
  name: 'react-codeshift',
  versionRange: '^1.0.0',
  source: 'package.json',
  line: 12,
};

describe('detectMissingPackage (PKG001)', () => {
  it('blocks packages missing from the registry', () => {
    const finding = detectMissingPackage(dependency, { status: 'missing' });

    expect(finding).toMatchObject({
      rule: 'PKG001',
      severity: 'block',
      confidence: 'high',
      package: 'react-codeshift',
      source: 'package.json',
      line: 12,
    });
    expect(finding?.message).toContain('does not exist');
  });

  it('stays quiet when the package exists or is unknown', () => {
    expect(detectMissingPackage(dependency, { status: 'found', metadata: { installScripts: [] } })).toBeNull();
    expect(detectMissingPackage(dependency, { status: 'unknown', reason: 'timeout' })).toBeNull();
  });
});
