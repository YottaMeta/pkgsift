import { thresholds } from '../config.js';
import { countBySeverity } from './pretty.js';
import type { ScanResult } from '../types.js';

export function formatJson(result: ScanResult): string {
  const counts = countBySeverity(result.findings);

  return JSON.stringify(
    {
      schemaVersion: '1',
      summary: {
        scanned: result.dependencies.length,
        block: counts.block,
        warn: counts.warn,
        info: counts.info,
        unknown: result.unknown.length,
      },
      thresholds: { ...thresholds },
      findings: result.findings,
      unknown: result.unknown,
      errors: result.errors,
    },
    null,
    2,
  );
}
