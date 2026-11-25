/** Shared type definitions. See docs/specs/ for the normative text. */

export const CAPABILITY_SCHEMA = 'oneorigin.capability/v0.0.1' as const;
export const BUNDLE_SCHEMA = 'oneorigin.bundle/v0.0.1' as const;

export type CapabilityKind =
  | 'agent-skill'
  | 'human-skill'
  | 'system-capability'
  | 'workflow'
  | 'knowledge'
  | 'standard';

export type PermissionScope =
  | 'workspace.read'
  | 'workspace.write'
  | 'network'
  | 'execution'
  | 'credentials'
  | 'model'
  | 'system';

export const PERMISSION_SCOPES: readonly PermissionScope[] = [
  'workspace.read',
  'workspace.write',
  'network',
  'execution',
  'credentials',
  'model',
  'system',
];

export type PermissionLevel = 'none' | 'ask' | 'grant';

export interface PermissionRequest {
  scope: PermissionScope;
  level: PermissionLevel;
  reason: string;
}

export interface Requirement {
  id: string;
  versionRange?: string;
  optional?: boolean;
  reason?: string;
}

export type InterfaceType =
  | 'command'
  | 'function'
  | 'http'
  | 'mcp-tool'
  | 'prompt'
  | 'resource';

export interface CapabilityInterface {
  name: string;
  type: InterfaceType;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface Signature {
  algorithm: 'ed25519' | 'sha256';
  value: string;
  signer?: string;
}

export interface Provenance {
  origin?: string;
  publishedAt?: string;
  signatures?: Signature[];
}

export interface CapabilityManifest {
  schema: typeof CAPABILITY_SCHEMA;
  id: string;
  name: string;
  version: string;
  kind: CapabilityKind;
  summary: string;
  description?: string;
  authors?: string[];
  license?: string;
  tags?: string[];
  entry?: string;
  requires?: Requirement[];
  permissions?: PermissionRequest[];
  interfaces?: CapabilityInterface[];
  provenance?: Provenance;
  checksum?: string;
  extensions?: Record<string, unknown>;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  code: string;
  severity: Severity;
  path: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface Grant {
  id: string;
  subject: string;
  capabilityId: string;
  capabilityVersion: string;
  scope: PermissionScope;
  resource: string;
  decision: 'allow' | 'deny';
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  reason: string;
}

export type AuditStage =
  | 'intent'
  | 'plan'
  | 'authorization'
  | 'execution'
  | 'verification'
  | 'persistence'
  | 'provenance'
  | 'result';

export interface AuditEntry {
  seq: number;
  at: string;
  stage: AuditStage;
  actor: string;
  capabilityId?: string;
  summary: string;
  data?: Record<string, unknown>;
  previousHash: string;
  entryHash: string;
}

export interface ExecutionInput {
  command: string;
  args?: string[];
  cwd?: string;
  environment?: Record<string, string>;
}

export interface ExecutionPlan {
  adapterId: string;
  steps: string[];
  requiredScopes: PermissionScope[];
  target: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  evidence?: string;
}

export interface ExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

export interface VerificationReport {
  ok: boolean;
  checks: CheckResult[];
}

export interface AdapterDescription {
  id: string;
  name: string;
  sandboxed: boolean;
  scopes: PermissionScope[];
  limitations: string;
}

export interface ExecutionContext {
  workspaceId: string;
  sessionId: string;
  approved: (scope: PermissionScope, target: string) => Promise<boolean>;
}

/** Adapter interface; implementations live in CoreBase. */
export interface ExecutionAdapter {
  id: string;
  requiredScopes: PermissionScope[];
  describe(): AdapterDescription;
  plan(input: ExecutionInput): Promise<ExecutionPlan>;
  execute(plan: ExecutionPlan, ctx: ExecutionContext): Promise<ExecutionOutput>;
  verify(plan: ExecutionPlan, output: ExecutionOutput): Promise<VerificationReport>;
}

export interface BundleItem {
  path: string;
  mediaType: string;
  bytes: string;
  sha256: string;
}

export interface Bundle {
  schema: typeof BUNDLE_SCHEMA;
  kind: 'skill-pack' | 'workspace';
  createdAt: string;
  items: BundleItem[];
  manifests: CapabilityManifest[];
  signature?: Signature;
}
