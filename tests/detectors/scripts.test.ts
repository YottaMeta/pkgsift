import { describe, expect, it } from 'vitest';

import { detectInstallScripts } from '../../src/detectors/scripts.js';
import type { Dependency, LookupResult } from '../../src/types.js';

function npmDependency(name: string): Dependency {
  return { ecosystem: 'npm', name, versionRange: '^1.0.0', source: 'package.json' };
}

const withScripts: LookupResult = {
  status: 'found',
  metadata: { installScripts: ['postinstall'] },
};

describe('detectInstallScripts (PKG004)', () => {
  it('warns on install scripts from packages outside the allowlist', () => {
    const finding = detectInstallScripts(npmDependency('mystery-pkg'), withScripts);

    expect(finding).toMatchObject({
      rule: 'PKG004',
      severity: 'warn',
      confidence: 'medium',
      package: 'mystery-pkg',
    });
    expect(finding?.evidence['scripts']).toEqual(['postinstall']);
  });

  it('allows known packages that legitimately need install scripts', () => {
    expect(detectInstallScripts(npmDependency('esbuild'), withScripts)).toBeNull();
    expect(detectInstallScripts(npmDependency('@prisma/client'), withScripts)).toBeNull();
    expect(detectInstallScripts(npmDependency('playwright-chromium'), withScripts)).toBeNull();
  });

  it('does not apply to PyPI packages or packages without scripts', () => {
    const pypi: Dependency = { ecosystem: 'pypi', name: 'requests', source: 'requirements.txt' };
    expect(detectInstallScripts(pypi, withScripts)).toBeNull();
    expect(
      detectInstallScripts(npmDependency('plain-pkg'), {
        status: 'found',
        metadata: { installScripts: [] },
      }),
    ).toBeNull();
  });
});
