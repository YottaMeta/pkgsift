import pc from 'picocolors';

import { thresholds } from '../config.js';
import type { ScanResult, Severity } from '../types.js';

const LABELS: Record<Severity, string> = {
  block: pc.red(pc.bold('BLOCK')),
  warn: pc.yellow(pc.bold('WARN')),
  info: pc.blue(pc.bold('INFO')),
};

export function formatPretty(result: ScanResult): string {
  const counts = countBySeverity(result.findings);
  const dependencyCount = result.dependencies.length;
  const lines: string[] = [];

  lines.push(
    pc.dim(
      `Scanned ${result.manifests.length} manifest(s) and ${dependencyCount} dependenc${
        dependencyCount === 1 ? 'y' : 'ies'
      } under ${result.root}`,
    ),
  );

  if (result.manifests.length === 0) {
    lines.push(pc.yellow('No dependency manifests found.'));
  }

  if (result.findings.length > 0) {
    lines.push('');
    for (const finding of result.findings) {
      const location = finding.line ? `${finding.source}:${finding.line}` : finding.source;
      const version = finding.versionRange ? pc.dim(`@${finding.versionRange}`) : '';
      lines.push(
        `${LABELS[finding.severity]} ${pc.bold(finding.rule)} ${pc.bold(finding.package)}${version} ${pc.dim(
          `— ${location}`,
        )}`,
      );
      lines.push(`  ${finding.message}`);
      lines.push(`  ${pc.dim('fix:')} ${finding.fix}`);
    }
  }

  if (result.unknown.length > 0) {
    lines.push('');
    for (const check of result.unknown) {
      lines.push(pc.yellow(`UNKNOWN ${check.package} (${check.source}) — ${check.reason}`));
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    for (const error of result.errors) {
      lines.push(pc.red(`ERROR ${error.source}: ${error.message}`));
    }
  }

  lines.push('');
  lines.push(
    pc.dim(
      `thresholds: new package < ${thresholds.newPackageMaxAgeDays}d · typosquat ≤ 1 (≤ ${thresholds.typosquatMaxDistance} for names ≥ ${thresholds.typosquatLongNameLength} chars)`,
    ),
  );
  lines.push(
    `block ${counts.block} · warn ${counts.warn} · info ${counts.info} · unknown ${result.unknown.length}`,
  );

  if (result.errors.length > 0 || result.unknown.length > 0) {
    lines.push(pc.red('Scan incomplete — this is not a pass.'));
  } else if (counts.block > 0) {
    lines.push(pc.red(`${counts.block} blocking issue(s) found.`));
  } else if (counts.warn > 0) {
    lines.push(pc.yellow(`${counts.warn} warning(s) found.`));
  } else {
    lines.push(pc.green('No issues found.'));
  }

  return lines.join('\n');
}

export function countBySeverity(findings: ScanResult['findings']): Record<Severity, number> {
  const counts: Record<Severity, number> = { block: 0, warn: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}
