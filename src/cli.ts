#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';

import { formatJson } from './report/json.js';
import { formatMarkdown } from './report/markdown.js';
import { formatPretty } from './report/pretty.js';
import { formatSarif } from './report/sarif.js';
import { scanDirectory } from './scan.js';
import type { ScanResult } from './types.js';
import { VERSION } from './version.js';

type FailOn = 'block' | 'warn' | 'none';
type OutputFormat = 'pretty' | 'json' | 'markdown' | 'sarif';

const FAIL_ON_LEVELS: readonly string[] = ['block', 'warn', 'none'];
const OUTPUT_FORMATS: readonly string[] = ['pretty', 'json', 'markdown', 'sarif'];

const program = new Command();

program
  .name('pkgsift')
  .description('Sift before you install. Catch hallucinated and typosquatted dependencies.')
  .version(VERSION);

program
  .command('scan')
  .description('Scan dependency manifests in a directory')
  .argument('[path]', 'directory to scan', '.')
  .option('--format <format>', 'output format: pretty, json, markdown, sarif', 'pretty')
  .option('--json', 'shorthand for --format json')
  .option('--fail-on <level>', 'exit non-zero on: block, warn, none', 'block')
  .option('--no-cache', 'ignore the local metadata cache')
  .action(
    async (
      path: string,
      options: { format: string; json?: boolean; failOn: string; cache: boolean },
    ) => {
      if (!FAIL_ON_LEVELS.includes(options.failOn)) {
        console.error(`Invalid --fail-on value: ${options.failOn} (expected block, warn, or none)`);
        process.exitCode = 2;
        return;
      }

      const format = options.json ? 'json' : options.format;
      if (!OUTPUT_FORMATS.includes(format)) {
        console.error(`Invalid --format value: ${format} (expected pretty, json, markdown, or sarif)`);
        process.exitCode = 2;
        return;
      }

      const result = await scanDirectory(path, { cache: options.cache });
      console.log(render(result, format as OutputFormat));

      process.exitCode = exitCode(result, options.failOn as FailOn);
    },
  );

function render(result: ScanResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'markdown':
      return formatMarkdown(result);
    case 'sarif':
      return formatSarif(result);
    case 'pretty':
      return `${pc.bold('PkgSift')} ${pc.dim(`v${VERSION}`)} — sift before you install\n\n${formatPretty(
        result,
      )}`;
  }
}

function exitCode(result: ScanResult, failOn: FailOn): number {
  if (result.errors.length > 0 || result.unknown.length > 0) return 2;

  const block = result.findings.filter((finding) => finding.severity === 'block').length;
  const warn = result.findings.filter((finding) => finding.severity === 'warn').length;

  if (block > 0) return 1;
  if (failOn === 'warn' && warn > 0) return 1;
  return 0;
}

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
