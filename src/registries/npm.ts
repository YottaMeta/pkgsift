import type { LookupResult, PackageMetadata } from '../types.js';
import { asRecord, isRecord, stringOrUndefined } from '../util/records.js';
import { fetchJson } from './http.js';

const INSTALL_SCRIPT_FIELDS = ['preinstall', 'install', 'postinstall'] as const;
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export interface RegistryOptions {
  timeoutMs?: number;
}

export async function lookupNpmPackage(
  name: string,
  options: RegistryOptions = {},
): Promise<LookupResult> {
  const base = (process.env['PKGSIFT_NPM_REGISTRY'] ?? DEFAULT_REGISTRY).replace(/\/+$/, '');
  const url = `${base}/${encodeURIComponent(name)}`;

  try {
    const { status, body } = await fetchJson(url, { timeoutMs: options.timeoutMs });
    if (status === 404) return { status: 'missing' };

    if (!isRecord(body) || !isRecord(body.versions)) {
      return { status: 'unknown', reason: 'unexpected npm registry response' };
    }

    return { status: 'found', metadata: extractMetadata(body) };
  } catch (error) {
    return { status: 'unknown', reason: errorMessage(error) };
  }
}

export function extractMetadata(body: Record<string, unknown>): PackageMetadata {
  const time = asRecord(body.time);
  const distTags = asRecord(body['dist-tags']);
  const latestVersion = stringOrUndefined(distTags?.['latest']);
  const versions = asRecord(body.versions);
  const latest = latestVersion ? asRecord(versions?.[latestVersion]) : undefined;
  const scripts = asRecord(latest?.scripts);

  const installScripts = INSTALL_SCRIPT_FIELDS.filter(
    (field) => typeof scripts?.[field] === 'string',
  );

  return {
    firstPublishedAt: stringOrUndefined(time?.['created']),
    latestVersion,
    repository: repositoryUrl(latest?.repository ?? body.repository),
    homepage: stringOrUndefined(body.homepage),
    license: licenseValue(latest?.license ?? body.license),
    maintainerCount: Array.isArray(body.maintainers) ? body.maintainers.length : undefined,
    installScripts: [...installScripts],
  };
}

function repositoryUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return stringOrUndefined(record?.['url']);
}

function licenseValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return stringOrUndefined(record?.['type']);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
