const NAME_RE = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*(.*)$/;

export interface ParsedRequirement {
  name: string;
  versionRange?: string;
}

/**
 * Parses a PEP 508 requirement string such as
 * `requests[socks]>=2.31,<3 ; python_version > "3.8"`.
 * Returns null for lines that are not registry requirements (URLs, flags, comments).
 */
export function parsePep508(spec: string): ParsedRequirement | null {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^(?:git\+|https?:\/\/|file:|\.{1,2}[\\/]|\/)/i.test(trimmed)) return null;

  const match = NAME_RE.exec(trimmed);
  if (!match) return null;

  const name = match[1];
  if (!name) return null;

  let rest = (match[2] ?? '').trim();

  const markerIndex = rest.indexOf(';');
  if (markerIndex !== -1) rest = rest.slice(0, markerIndex).trim();

  const inlineFlagIndex = rest.search(/(^|\s)--/);
  if (inlineFlagIndex !== -1) rest = rest.slice(0, inlineFlagIndex).trim();

  const commentIndex = rest.indexOf(' #');
  if (commentIndex !== -1) rest = rest.slice(0, commentIndex).trim();

  return { name, versionRange: rest || undefined };
}

export function normalizePypiName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}
