import { normalizePypiName } from '../manifests/requirement.js';
import type { LookupResult, PackageMetadata } from '../types.js';
import { asRecord, stringOrUndefined } from '../util/records.js';
import { fetchJson } from './http.js';

const SOURCE_URL_KEYS = ['source', 'source code', 'repository', 'code'];
const DEFAULT_REGISTRY = 'https://pypi.org';

export interface RegistryOptions {
  timeoutMs?: number;
}

export async function lookupPypiPackage(
  name: string,
  options: RegistryOptions = {},
): Promise<LookupResult> {
  const base = (process.env['PKGSIFT_PYPI_REGISTRY'] ?? DEFAULT_REGISTRY).replace(/\/+$/, '');
  const url = `${base}/pypi/${encodeURIComponent(normalizePypiName(name))}/json`;

  try {
    const { status, body } = await fetchJson(url, { timeoutMs: options.timeoutMs });
    if (status === 404) return { status: 'missing' };

    const info = asRecord(asRecord(body)?.info);
    if (!info) return { status: 'unknown', reason: 'unexpected PyPI response' };

    return { status: 'found', metadata: extractMetadata(info, asRecord(asRecord(body)?.releases)) };
  } catch (error) {
    return { status: 'unknown', reason: error instanceof Error ? error.message : String(error) };
  }
}

export function extractMetadata(
  info: Record<string, unknown>,
  releases: Record<string, unknown> | undefined,
): PackageMetadata {
  return {
    firstPublishedAt: firstUpload(releases),
    latestVersion: stringOrUndefined(info.version),
    repository: sourceUrl(info),
    homepage: stringOrUndefined(info.home_page) ?? stringOrUndefined(info.homepage),
    license: validLicense(info.license),
    maintainerCount: undefined,
    installScripts: [],
  };
}

function firstUpload(releases: Record<string, unknown> | undefined): string | undefined {
  if (!releases) return undefined;

  let earliest: string | undefined;
  for (const files of Object.values(releases)) {
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      const record = asRecord(file);
      const uploaded =
        stringOrUndefined(record?.['upload_time_iso_8601']) ??
        stringOrUndefined(record?.['upload_time']);
      if (uploaded && (!earliest || uploaded < earliest)) earliest = uploaded;
    }
  }
  return earliest;
}

function sourceUrl(info: Record<string, unknown>): string | undefined {
  const projectUrls = asRecord(info.project_urls);
  if (projectUrls) {
    const entries = Object.entries(projectUrls);
    for (const wanted of SOURCE_URL_KEYS) {
      const match = entries.find(
        ([key, value]) => key.toLowerCase() === wanted && typeof value === 'string' && value.length > 0,
      );
      if (match) return match[1] as string;
    }
  }
  for (const field of ['home_page', 'project_url']) {
    const value = stringOrUndefined(info[field]);
    if (value) return value;
  }
  return undefined;
}

function validLicense(value: unknown): string | undefined {
  const license = stringOrUndefined(value);
  if (!license || license.toUpperCase() === 'UNKNOWN') return undefined;
  return license;
}
