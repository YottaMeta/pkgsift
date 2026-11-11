import { thresholds } from '../config.js';
import type { ScanResult, Severity } from '../types.js';
import { countBySeverity } from './pretty.js';

const SECTIONS: Array<{ severity: Severity; title: string }> = [
  { severity: 'block', title: 'Blocking' },
  { severity: 'warn', title: 'Warnings' },
  { severity: 'info', title: 'Notes' },
];

export function formatMarkdown(result: ScanResult): string {
  const counts = countBySeverity(result.findings);
  const total = result.dependencies.length;
  const lines: string[] = [];

  lines.push('## PkgSift report');
  lines.push('');
  lines.push(
    `Scanned ${result.manifests.length} manifest(s) and ${total} dependenc${
      total === 1 ? 'y' : 'ies'
    } — **${counts.block} block**, **${counts.warn} warn**, **${counts.info} info**, **${result.unknown.length} unknown**.`,
  );

  for (const { severity, title } of SECTIONS) {
    const findings = result.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;

    lines.push('');
    lines.push(`### ${title} (${findings.length})`);
    lines.push('');

    for (const finding of findings) {
      const version = finding.versionRange ? `@${finding.versionRange}` : '';
      const location = finding.line ? `${finding.source}:${finding.line}` : finding.source;
      lines.push(
        `- **${finding.rule}** ${code(`${finding.package}${version}`)} — ${code(location)}`,
      );
      lines.push(`  ${finding.message}`);
      lines.push(`  _Fix:_ ${finding.fix}`);
    }
  }

  if (result.unknown.length > 0) {
    lines.push('');
    lines.push(`### Incomplete checks (${result.unknown.length})`);
    lines.push('');
    for (const check of result.unknown) {
      lines.push(`- ${code(check.package)} — ${code(check.source)}: ${check.reason}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push(`### Errors (${result.errors.length})`);
    lines.push('');
    for (const error of result.errors) {
      lines.push(`- ${code(error.source)}: ${error.message}`);
    }
  }

  lines.push('');
  if (result.errors.length > 0 || result.unknown.length > 0) {
    lines.push('> **Scan incomplete — this is not a pass.**');
  } else if (counts.block > 0) {
    lines.push(`> **${counts.block} blocking issue(s) found.**`);
  } else if (counts.warn > 0) {
    lines.push(`> ${counts.warn} warning(s) found.`);
  } else {
    lines.push('> No issues found.');
  }

  lines.push('');
  lines.push(
    `_Thresholds: new package < ${thresholds.newPackageMaxAgeDays} days; typosquat distance ≤ 1 (≤ ${thresholds.typosquatMaxDistance} for names ≥ ${thresholds.typosquatLongNameLength} chars)._`,
  );

  return lines.join('\n');
}

function code(value: string): string {
  return value.includes('`') ? `\`\` ${value} \`\`` : `\`${value}\``;
}
