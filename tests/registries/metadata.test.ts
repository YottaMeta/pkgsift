import { describe, expect, it } from 'vitest';

import { extractMetadata as extractNpmMetadata } from '../../src/registries/npm.js';
import { extractMetadata as extractPypiMetadata } from '../../src/registries/pypi.js';

describe('extractNpmMetadata', () => {
  it('reads release date, repository, license, maintainers, and install scripts', () => {
    const metadata = extractNpmMetadata({
      'dist-tags': { latest: '1.2.3' },
      time: { created: '2020-01-01T00:00:00.000Z' },
      maintainers: [{ name: 'a' }, { name: 'b' }],
      homepage: 'https://example.com',
      versions: {
        '1.2.3': {
          repository: 'github:owner/repo',
          license: 'MIT',
          scripts: {
            preinstall: 'node setup.js',
            postinstall: 'node post.js',
            test: 'vitest',
          },
        },
      },
    });

    expect(metadata).toEqual({
      firstPublishedAt: '2020-01-01T00:00:00.000Z',
      latestVersion: '1.2.3',
      repository: 'github:owner/repo',
      homepage: 'https://example.com',
      license: 'MIT',
      maintainerCount: 2,
      installScripts: ['preinstall', 'postinstall'],
    });
  });

  it('tolerates sparse metadata', () => {
    const metadata = extractNpmMetadata({ versions: {} });

    expect(metadata.installScripts).toEqual([]);
    expect(metadata.latestVersion).toBeUndefined();
  });
});

describe('extractPypiMetadata', () => {
  it('finds the earliest release and the source URL', () => {
    const metadata = extractPypiMetadata(
      {
        version: '2.31.0',
        license: 'Apache-2.0',
        home_page: 'https://requests.readthedocs.io',
        project_urls: {
          Homepage: 'https://requests.readthedocs.io',
          Source: 'https://github.com/psf/requests',
        },
      },
      {
        '0.1.0': [{ upload_time_iso_8601: '2011-02-15T00:00:00.000Z' }],
        '2.31.0': [{ upload_time_iso_8601: '2023-05-22T00:00:00.000Z' }],
      },
    );

    expect(metadata.firstPublishedAt).toBe('2011-02-15T00:00:00.000Z');
    expect(metadata.repository).toBe('https://github.com/psf/requests');
    expect(metadata.license).toBe('Apache-2.0');
    expect(metadata.installScripts).toEqual([]);
  });

  it('drops unknown licenses', () => {
    const metadata = extractPypiMetadata({ license: 'UNKNOWN' }, undefined);
    expect(metadata.license).toBeUndefined();
  });
});
