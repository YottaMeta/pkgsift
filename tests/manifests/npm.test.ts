import { describe, expect, it } from 'vitest';

import { parsePackageJson } from '../../src/manifests/npm.js';

const MANIFEST = `{
  "name": "demo",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.19.2",
    "left-pad": "1.3.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "express": "^5.0.0"
  },
  "optionalDependencies": {
    "fsevents": "^2.3.0"
  }
}`;

describe('parsePackageJson', () => {
  it('extracts dependencies from all install-relevant sections', () => {
    const dependencies = parsePackageJson(MANIFEST, 'package.json');

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      'express',
      'left-pad',
      'vitest',
      'fsevents',
    ]);
    expect(dependencies.every((dependency) => dependency.ecosystem === 'npm')).toBe(true);
    expect(dependencies.every((dependency) => dependency.source === 'package.json')).toBe(true);
  });

  it('records version ranges and manifest line numbers', () => {
    const [express] = parsePackageJson(MANIFEST, 'package.json');

    expect(express).toMatchObject({
      name: 'express',
      versionRange: '^4.19.2',
      line: 5,
    });
  });

  it('keeps the first occurrence and does not duplicate a package', () => {
    const dependencies = parsePackageJson(MANIFEST, 'package.json');
    const express = dependencies.filter((dependency) => dependency.name === 'express');

    expect(express).toHaveLength(1);
    expect(express[0]?.versionRange).toBe('^4.19.2');
  });

  it('ignores non-string and non-object sections', () => {
    const content = JSON.stringify({
      dependencies: { ok: '1.0.0', broken: 42 },
      devDependencies: 'nope',
    });

    const dependencies = parsePackageJson(content, 'package.json');

    expect(dependencies.map((dependency) => dependency.name)).toEqual(['ok']);
  });

  it('accepts a UTF-8 BOM', () => {
    const dependencies = parsePackageJson(`\uFEFF${MANIFEST}`, 'package.json');

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      'express',
      'left-pad',
      'vitest',
      'fsevents',
    ]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parsePackageJson('{', 'package.json')).toThrow();
  });
});
