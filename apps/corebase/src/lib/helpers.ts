import type {
  CheckResult,
  ExecutionOutput,
  Grant,
  PermissionScope,
  VerificationReport,
} from '@oneorigin/contracts';
import type { FileKind } from './types';

/** The complete command set exposed by the sandboxed shell. Nothing else is dispatchable. */
export const ALLOWED_COMMANDS = [
  'help',
  'pwd',
  'ls',
  'cat',
  'echo',
  'mkdir',
  'touch',
  'rm',
  'clear',
  'date',
  'whoami',
  'skills',
] as const;

export type CommandName = (typeof ALLOWED_COMMANDS)[number];

const DESCRIPTIONS: Record<CommandName, string> = {
  help: 'List the bounded command set',
  pwd: 'Print the virtual working directory',
  ls: 'List a virtual directory',
  cat: 'Print a virtual file',
  echo: 'Print the supplied text',
  mkdir: 'Create a virtual directory',
  touch: 'Create an empty virtual file',
  rm: 'Remove a virtual file or empty directory (approval required)',
  clear: 'Clear the terminal output',
  date: 'Print the current time',
  whoami: 'Print the guest identity',
  skills: 'List SKILL.md documents in this workspace',
};

export function isAllowedCommand(value: string): value is CommandName {
  return (ALLOWED_COMMANDS as readonly string[]).includes(value);
}

export function describeCommand(command: CommandName): string {
  return DESCRIPTIONS[command];
}

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
  error?: string;
}

/** Splits a command line on whitespace with single/double quote support. No shell evaluation. */
export function tokenize(raw: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const char of raw) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }
  if (quote) return null;
  if (started) tokens.push(current);
  return tokens;
}

export function parseCommand(raw: string): ParsedCommand {
  const tokens = tokenize(raw);
  if (!tokens || tokens.length === 0) {
    return {
      command: '',
      args: [],
      raw,
      error: tokens === null ? 'Unterminated quote. Close the quoted argument.' : 'Enter a command. Type help for the command list.',
    };
  }
  const [head, ...args] = tokens;
  return { command: head.toLowerCase(), args, raw };
}

/**
 * Resolves a workspace-relative path inside the virtual root. Returns null when the path
 * tries to escape the sandbox root or contains NUL. No host filesystem is consulted.
 */
export function resolveVirtualPath(cwd: string, input: string): string | null {
  const cwdParts = cwd.split('/').filter((part) => part.length > 0);
  const raw = input.trim();
  if (raw.includes('\0')) return null;
  const parts = raw.startsWith('/') ? raw.split('/') : [...cwdParts, ...raw.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (resolved.length === 0) return null;
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join('/');
}

export function mediaTypeForPath(path: string): string {
  if (path.toLowerCase().endsWith('.md')) return 'text/markdown';
  if (/\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(path)) return 'text/javascript';
  if (path.toLowerCase().endsWith('.json')) return 'application/json';
  if (path.toLowerCase().endsWith('.yaml') || path.toLowerCase().endsWith('.yml')) return 'application/yaml';
  return 'text/plain';
}

export function stateValue(kind: FileKind, content: string): string {
  return `${kind}:${content}`;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

export interface TreeRow {
  node: TreeNode;
  depth: number;
}

export function buildFileTree(sources: Array<{ path: string; kind: FileKind }>): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] };
  for (const source of sources) {
    const segments = source.path.split('/').filter((part) => part.length > 0);
    let parent = root;
    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1 && source.kind === 'file';
      const path = segments.slice(0, index + 1).join('/');
      let child = parent.children.find((item) => item.name === segment);
      if (!child) {
        child = { name: segment, path, isDirectory: !isFile, children: [] };
        parent.children.push(child);
      }
      if (isFile) child.isDirectory = false;
      parent = child;
    });
  }
  const sort = (node: TreeNode): TreeNode => ({
    ...node,
    children: node.children
      .map(sort)
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)),
  });
  return sort(root).children;
}

export function flattenTree(nodes: TreeNode[], depth = 0): TreeRow[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenTree(node.children, depth + 1)]);
}

export interface PermissionInput {
  grants: Grant[];
  subject: string;
  capabilityId: string;
  capabilityVersion: string;
  scope: PermissionScope;
  resource: string;
  now: string;
  approvalsEnabled?: boolean;
}

export type PermissionDecision =
  | { kind: 'allow'; grant: Grant }
  | { kind: 'deny'; reason: string }
  | { kind: 'approval-required'; reason: string };

export function isGrantActive(grant: Grant, nowMs: number): boolean {
  if (grant.decision !== 'allow' || grant.revokedAt) return false;
  const starts = Date.parse(grant.grantedAt);
  if (Number.isNaN(starts) || starts > nowMs) return false;
  if (grant.expiresAt) {
    const expires = Date.parse(grant.expiresAt);
    if (Number.isNaN(expires) || expires <= nowMs) return false;
  }
  return true;
}

/** Pure default-deny decision. Grants must match subject, capability, version, scope and exact resource. */
export function evaluatePermission(input: PermissionInput): PermissionDecision {
  const nowMs = Date.parse(input.now);
  const matches = input.grants.filter(
    (grant) =>
      grant.subject === input.subject &&
      grant.capabilityId === input.capabilityId &&
      grant.capabilityVersion === input.capabilityVersion &&
      grant.scope === input.scope &&
      grant.resource === input.resource,
  );

  const denied = matches.find((grant) => grant.decision === 'deny' && !grant.revokedAt);
  if (denied) return { kind: 'deny', reason: denied.reason || 'An explicit deny grant applies.' };

  const allowed = matches.find((grant) => isGrantActive(grant, nowMs));
  if (allowed) return { kind: 'allow', grant: allowed };

  const inactive = matches.find((grant) => grant.revokedAt || (grant.expiresAt && Date.parse(grant.expiresAt) <= nowMs));
  const reason = inactive?.revokedAt
    ? 'The matching grant was revoked.'
    : inactive?.expiresAt
      ? 'The matching grant has expired.'
      : 'No active grant authorizes this scope on this resource.';

  if (input.approvalsEnabled === false) {
    return { kind: 'deny', reason: `${reason} Approval prompts are disabled.` };
  }
  return { kind: 'approval-required', reason };
}

const READ_ONLY_COMMANDS = new Set<string>(['help', 'pwd', 'ls', 'cat', 'echo', 'date', 'whoami', 'skills', 'clear']);

/** Compares the virtual filesystem before and after one command. Pure and deterministic. */
export function verifyStateTransition(
  before: Record<string, string>,
  after: Record<string, string>,
  command: string,
  target: string,
): CheckResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const path of Object.keys(after)) {
    if (!(path in before)) added.push(path);
    else if (before[path] !== after[path]) changed.push(path);
  }
  for (const path of Object.keys(before)) {
    if (!(path in after)) removed.push(path);
  }
  added.sort();
  removed.sort();
  changed.sort();
  const evidence = JSON.stringify({ added, removed, changed });

  if (READ_ONLY_COMMANDS.has(command)) {
    const passed = added.length === 0 && removed.length === 0 && changed.length === 0;
    return {
      name: 'expectedState',
      passed,
      detail: passed
        ? `Read-only command "${command}" left the virtual filesystem unchanged.`
        : `Read-only command "${command}" unexpectedly changed: ${evidence}`,
      evidence,
    };
  }
  if (command === 'mkdir' || command === 'touch') {
    const passed =
      (added.length === 1 && added[0] === target && removed.length === 0 && changed.length === 0) ||
      (added.length === 0 && removed.length === 0 && changed.length === 0);
    return {
      name: 'expectedState',
      passed,
      detail: passed
        ? `Target "${target}" is present and no unrelated state changed.`
        : `Unexpected state delta for ${command}: ${evidence}`,
      evidence,
    };
  }
  if (command === 'rm') {
    const passed = removed.length === 1 && removed[0] === target && added.length === 0 && changed.length === 0;
    return {
      name: 'expectedState',
      passed,
      detail: passed ? `Target "${target}" was removed.` : `Unexpected state delta for rm: ${evidence}`,
      evidence,
    };
  }
  return {
    name: 'expectedState',
    passed: false,
    detail: `No state rule is defined for "${command}".`,
    evidence,
  };
}

/** A result is successful only when every named check passes. */
export function buildVerificationReport(output: ExecutionOutput, stateCheck: CheckResult): VerificationReport {
  const checks: CheckResult[] = [
    {
      name: 'exitCodeZero',
      passed: output.exitCode === 0,
      detail: output.exitCode === 0 ? 'Command exited with status 0.' : `Command exited with status ${output.exitCode}.`,
    },
    {
      name: 'outputCaptured',
      passed: typeof output.stdout === 'string' && typeof output.stderr === 'string',
      detail: 'Adapter returned both stdout and stderr channels.',
    },
    stateCheck,
  ];
  return { ok: checks.every((check) => check.passed), checks };
}
