import { describe, expect, it } from 'vitest';

import { isRegistryResolvable } from '../../src/scan.js';
import { registryKey } from '../../src/registries/index.js';

describe('isRegistryResolvable', () => {
  it('keeps normal npm and PyPI requirements', () => {
    expect(isRegistryResolvable({ ecosystem: 'npm', name: 'express', versionRange: '^4', source: 'package.json' })).toBe(true);
    expect(isRegistryResolvable({ ecosystem: 'npm', name: 'express', source: 'package.json' })).toBe(true);
    expect(isRegistryResolvable({ ecosystem: 'pypi', name: 'requests', versionRange: '>=2', source: 'requirements.txt' })).toBe(true);
  });

  it('skips local, git, and aliased npm sources', () => {
    for (const versionRange of ['file:../x', 'link:../x', 'workspace:*', 'git+https://x', 'github:owner/repo', 'npm:real-pkg@^1']) {
      expect(
        isRegistryResolvable({ ecosystem: 'npm', name: 'x', versionRange, source: 'package.json' }),
      ).toBe(false);
    }
  });

  it('skips direct-URL PyPI requirements', () => {
    expect(
      isRegistryResolvable({ ecosystem: 'pypi', name: 'x', versionRange: '@ https://example.com/x.whl', source: 'requirements.txt' }),
    ).toBe(false);
  });
});

describe('registryKey', () => {
  it('normalizes PyPI names and keeps npm names as-is', () => {
    expect(registryKey('pypi', 'Zope.Interface')).toBe('pypi:zope-interface');
    expect(registryKey('npm', '@scope/Pkg')).toBe('npm:@scope/Pkg');
  });
});
