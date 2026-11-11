import { afterEach, describe, expect, it, vi } from 'vitest';

import { lookupPackages } from '../../src/registries/index.js';
import type { Dependency } from '../../src/types.js';

const npmDependency: Dependency = {
  ecosystem: 'npm',
  name: 'express',
  versionRange: '^4',
  source: 'package.json',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupPackages', () => {
  it('marks packages unknown when the registry is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const results = await lookupPackages([npmDependency], { cache: false });

    expect(results.get('npm:express')).toEqual({ status: 'unknown', reason: 'network down' });
  });

  it('returns missing on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));

    const results = await lookupPackages([npmDependency], { cache: false });

    expect(results.get('npm:express')).toEqual({ status: 'missing' });
  });

  it('extracts metadata on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '4.19.2' },
          time: { created: '2010-01-01T00:00:00.000Z' },
          versions: { '4.19.2': { scripts: { postinstall: 'node install.js' } } },
        }),
      }),
    );

    const results = await lookupPackages([npmDependency], { cache: false });

    expect(results.get('npm:express')).toMatchObject({
      status: 'found',
      metadata: { latestVersion: '4.19.2', installScripts: ['postinstall'] },
    });
  });

  it('normalizes PyPI package names in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 404, ok: false });
    vi.stubGlobal('fetch', fetchMock);

    await lookupPackages(
      [{ ecosystem: 'pypi', name: 'Zope.Interface', source: 'requirements.txt' }],
      { cache: false },
    );

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/pypi/zope-interface/json');
  });
});
