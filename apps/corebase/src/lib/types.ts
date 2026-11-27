import type { AuditStage, PermissionScope } from '@oneorigin/contracts';

export type TabId = 'editor' | 'terminal' | 'templates' | 'audit' | 'agents' | 'settings';

export type FileKind = 'file' | 'directory';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualFile {
  projectId: string;
  path: string;
  content: string;
  mediaType: string;
  kind: FileKind;
  updatedAt: string;
}

export type TerminalLineKind = 'input' | 'stdout' | 'stderr' | 'system' | 'success' | 'error';

export interface TerminalLine {
  id: string;
  at: string;
  kind: TerminalLineKind;
  text: string;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  cwd: string;
  history: string[];
  lines: TerminalLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckpointFile {
  path: string;
  content: string;
  mediaType: string;
  kind: FileKind;
}

/** Immutable workspace snapshot, addressable by its content hash. */
export interface Checkpoint {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  auditHead: string;
  checksum: string;
  files: CheckpointFile[];
  automatic: boolean;
}

export interface AppSettings {
  key: 'settings';
  activeAdapterId: string;
  activeModelAdapterId: string;
  /** Human approval prompts for consequential actions. Default on. */
  approvalsEnabled: boolean;
  /** Content-bearing diagnostics. Off by default and never transmitted. */
  contentTelemetry: boolean;
  /** Optional service URL. Guest work never contacts it. */
  serviceUrl?: string;
}

export interface ApprovalRequest {
  id: string;
  capabilityId: string;
  capabilityVersion: string;
  scope: PermissionScope;
  scopes: PermissionScope[];
  adapterId: string;
  target: string;
  reason: string;
  actor: string;
  projectId: string;
  createdAt: string;
  expiresInMinutes: number;
}

export interface ChainReport {
  ok: boolean;
  head: string;
  entries: number;
  breakAt?: number;
  reason?: string;
}

export type LifecycleStage = AuditStage | 'awaiting-approval';
