import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { parsePipfileContent } from '../../src/manifests/pipfile.js';
import { parsePyprojectContent } from '../../src/manifests/pyproject.js';
import {
  parseRequirementsContent,
  parseRequirementsFile,
} from '../../src/manifests/requirements.js';

const REQUIREMENTS = `# runtime
requests[socks]>=2.31,<3 ; python_version > "3.8"
flask==3.0.0  # web framework
-r base.txt
--index-url https://example.com/simple
-e .
git+https://github.com/foo/bar.git
urllib3 \\
    --hash=sha256:abc
`;

const PYPROJECT = `[project]
name = "demo"
dependencies = [
  "requests[socks]>=2.31",
  "flask==3.0.0",
]

[project.optional-dependencies]
dev = ["pytest>=8", "requests>=2.0"]

[dependency-groups]
test = ["coverage"]
all = [{ include-group = "test" }, "ruff"]

[tool.poetry.dependencies]
python = "^3.11"
httpx = "^0.27"
gitdep = { git = "https://github.com/x/y" }

[tool.poetry.group.docs.dependencies]
mkdocs = "^1.5"
`;

const PIPFILE = `[packages]
requests = "*"
django = { version = ">=4.2", extras = ["bcrypt"] }
gitdep = { git = "https://github.com/x/y" }

[dev-packages]
pytest = "*"
`;

describe('parseRequirementsContent', () => {
  it('extracts registry requirements and skips flags, URLs, and includes', () => {
    const dependencies = parseRequirementsContent(REQUIREMENTS, 'requirements.txt');

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      'requests',
      'flask',
      'urllib3',
    ]);
    expect(dependencies[0]).toMatchObject({
      ecosystem: 'pypi',
      versionRange: '>=2.31,<3',
      line: 2,
    });
    expect(dependencies[2]?.versionRange).toBeUndefined();
  });

  it('follows -r includes relative to the including file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkgsift-req-'));
    try {
      await writeFile(join(root, 'requirements.txt'), '-r base.txt\ndjango>=4.2\n', 'utf8');
      await writeFile(join(root, 'base.txt'), 'requests>=2.31\n', 'utf8');

      const dependencies = await parseRequirementsFile(
        'requirements.txt',
        join(root, 'requirements.txt'),
      );

      expect(dependencies.map((dependency) => [dependency.name, dependency.source])).toEqual([
        ['requests', 'base.txt'],
        ['django', 'requirements.txt'],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('parsePyprojectContent', () => {
  it('merges PEP 621, dependency groups, and Poetry dependencies', () => {
    const dependencies = parsePyprojectContent(PYPROJECT, 'pyproject.toml');

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      'requests',
      'flask',
      'pytest',
      'coverage',
      'ruff',
      'httpx',
      'mkdocs',
    ]);
    expect(dependencies[0]?.versionRange).toBe('>=2.31');
    expect(dependencies.find((dependency) => dependency.name === 'gitdep')).toBeUndefined();
  });

  it('throws on invalid TOML', () => {
    expect(() => parsePyprojectContent('[project', 'pyproject.toml')).toThrow(/Invalid TOML/);
  });
});

describe('parsePipfileContent', () => {
  it('reads packages and dev-packages, skipping non-registry sources', () => {
    const dependencies = parsePipfileContent(PIPFILE, 'Pipfile');

    expect(dependencies.map((dependency) => dependency.name)).toEqual([
      'requests',
      'django',
      'pytest',
    ]);
    expect(dependencies[1]?.versionRange).toBe('>=4.2');
  });
});
