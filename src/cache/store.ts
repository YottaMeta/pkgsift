import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface CacheEntry<T> {
  fetchedAt: number;
  value: T;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export class FileCache {
  constructor(
    private readonly directory = defaultCacheDirectory(),
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8');
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (typeof entry.fetchedAt !== 'number') return undefined;
      if (Date.now() - entry.fetchedAt > this.ttlMs) return undefined;
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await mkdir(this.directory, { recursive: true });
      const entry: CacheEntry<T> = { fetchedAt: Date.now(), value };
      await writeFile(this.pathFor(key), JSON.stringify(entry), 'utf8');
    } catch {
      // A cache write must never fail a scan.
    }
  }

  private pathFor(key: string): string {
    const digest = createHash('sha256').update(key).digest('hex');
    return join(this.directory, `${digest}.json`);
  }
}

function defaultCacheDirectory(): string {
  return process.env['PKGSIFT_CACHE_DIR'] ?? join(homedir(), '.cache', 'pkgsift');
}
