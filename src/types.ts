export type Ecosystem = 'npm' | 'pypi';

export type Severity = 'block' | 'warn' | 'info';

export type Confidence = 'high' | 'medium' | 'low';

export interface Dependency {
  ecosystem: Ecosystem;
  name: string;
  versionRange?: string;
  /** Manifest path relative to the scan root. */
  source: string;
  /** 1-based line in the manifest, when it can be located. */
  line?: number;
}

export interface Finding {
  rule: string;
  severity: Severity;
  confidence: Confidence;
  ecosystem: Ecosystem;
  package: string;
  versionRange?: string;
  source: string;
  line?: number;
  message: string;
  evidence: Record<string, unknown>;
  fix: string;
}

export interface ScanError {
  source: string;
  message: string;
}

export interface UnknownCheck {
  ecosystem: Ecosystem;
  package: string;
  source: string;
  reason: string;
}

export interface PackageMetadata {
  firstPublishedAt?: string;
  latestVersion?: string;
  repository?: string;
  homepage?: string;
  license?: string;
  maintainerCount?: number;
  installScripts: string[];
}

export type LookupResult =
  | { status: 'found'; metadata: PackageMetadata }
  | { status: 'missing' }
  | { status: 'unknown'; reason: string };

export interface ScanResult {
  root: string;
  manifests: string[];
  dependencies: Dependency[];
  findings: Finding[];
  unknown: UnknownCheck[];
  errors: ScanError[];
}

export interface ScanOptions {
  cache?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  /** Reference time for age-based rules; defaults to now. */
  now?: Date;
}
