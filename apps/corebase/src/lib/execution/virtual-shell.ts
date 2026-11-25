import type {
  AdapterDescription,
  ExecutionAdapter,
  ExecutionContext,
  ExecutionInput,
  ExecutionOutput,
  ExecutionPlan,
  PermissionScope,
  VerificationReport,
} from '@oneorigin/contracts';
import {
  ALLOWED_COMMANDS,
  buildVerificationReport,
  describeCommand,
  isAllowedCommand,
  parseCommand,
  resolveVirtualPath,
  verifyStateTransition,
} from '../helpers';
import { deleteFile, getFile, listFiles, makeFile, putFile, snapshotFiles } from '../storage';
import type { VirtualFile } from '../types';
import { managedPlan, type ManagedPlan } from './plan';

export const SHELL_ADAPTER_ID = 'virtual-shell';
export const SHELL_CAPABILITY_ID = 'oneorigin.corebase.shell';
export const SHELL_VERSION = '0.0.1';
export const APPROVAL_TTL_MINUTES = 10;

export const SHELL_LIMITATIONS =
  'Bounded to 12 commands. No process spawning, no eval, no network, no ambient host filesystem access. Files live in this browser only.';

const MUTATING = new Set(['mkdir', 'touch', 'rm']);

interface DispatchResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function scopesFor(command: string): PermissionScope[] {
  return ['execution', MUTATING.has(command) ? 'workspace.write' : 'workspace.read'];
}

function stepsFor(command: string, target: string, parsedError?: string): string[] {
  if (parsedError) return ['Reject malformed command line', parsedError];
  if (!isAllowedCommand(command)) return ['Reject command outside the bounded allowlist', `Requested: ${command || '(empty)'}`];
  switch (command) {
    case 'help': return ['List the bounded command set'];
    case 'pwd': return ['Read the virtual working directory'];
    case 'ls': return [`List virtual directory ${target || '/'}`];
    case 'cat': return [`Read virtual file ${target}`, 'Return its contents on stdout'];
    case 'echo': return ['Return literal arguments on stdout'];
    case 'mkdir': return [`Check ${target} does not exist`, `Create virtual directory ${target}`];
    case 'touch': return [`Create or update virtual file ${target}`];
    case 'rm': return [`Check ${target} exists and is empty if a directory`, `Remove ${target} after human approval`];
    case 'clear': return ['Clear the terminal view; leave workspace state unchanged'];
    case 'date': return ['Return the current timestamp'];
    case 'whoami': return ['Return the guest identity'];
    case 'skills': return ['Scan the workspace for SKILL.md documents'];
    default: return ['Reject unrecognized command'];
  }
}

async function dispatch(parsed: { command: string; args: string[] }, projectId: string, cwd: string): Promise<DispatchResult> {
  const ok = (stdout: string): DispatchResult => ({ stdout, stderr: '', exitCode: 0 });
  const fail = (stderr: string, exitCode = 1): DispatchResult => ({ stdout: '', stderr, exitCode });
  const command = parsed.command;
  const args = parsed.args;

  if (!isAllowedCommand(command)) {
    return fail(
      `Unknown command "${command}". Allowed commands: ${ALLOWED_COMMANDS.join(', ')}. Type help for details.`,
      127,
    );
  }

  switch (command) {
    case 'help':
      return ok(
        [
          'CoreBase virtual shell (sandboxed)',
          '',
          ...ALLOWED_COMMANDS.map((name) => `  ${name.padEnd(7)} ${describeCommand(name)}`),
          '',
          'No host processes, network access or ambient filesystem access are available.',
        ].join('\n'),
      );
    case 'pwd':
      return ok(`/${cwd}`);
    case 'ls': {
      const directory = args[0] ? resolveVirtualPath(cwd, args[0]) : cwd;
      if (directory === null) return fail('ls: path escapes the virtual root.');
      const prefix = directory ? `${directory}/` : '';
      const children = new Map<string, boolean>();
      for (const file of await listFiles(projectId)) {
        if (!file.path.startsWith(prefix)) continue;
        const rest = file.path.slice(prefix.length);
        if (!rest) continue;
        const [head, ...tail] = rest.split('/');
        children.set(head, tail.length > 0 || file.kind === 'directory');
      }
      if (children.size === 0) return ok('(empty directory)');
      return ok(
        [...children.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, isDirectory]) => (isDirectory ? `${name}/` : name))
          .join('\n'),
      );
    }
    case 'cat': {
      if (!args[0]) return fail('cat: missing file operand. Usage: cat <path>');
      const path = resolveVirtualPath(cwd, args[0]);
      if (path === null) return fail(`cat: ${args[0]}: path escapes the virtual root.`);
      const file = await getFile(projectId, path);
      if (!file) return fail(`cat: ${args[0]}: no such file.`);
      if (file.kind === 'directory') return fail(`cat: ${args[0]}: is a directory.`);
      return ok(file.content);
    }
    case 'echo':
      return ok(args.join(' '));
    case 'mkdir': {
      if (!args[0]) return fail('mkdir: missing directory operand. Usage: mkdir <path>');
      const path = resolveVirtualPath(cwd, args[0]);
      if (path === null) return fail(`mkdir: ${args[0]}: path escapes the virtual root.`);
      if (await getFile(projectId, path)) return fail(`mkdir: ${args[0]}: already exists.`);
      await putFile(makeFile(projectId, path, '', 'directory'));
      return ok(`Created virtual directory ${path}`);
    }
    case 'touch': {
      if (!args[0]) return fail('touch: missing file operand. Usage: touch <path>');
      const path = resolveVirtualPath(cwd, args[0]);
      if (path === null) return fail(`touch: ${args[0]}: path escapes the virtual root.`);
      const existing = await getFile(projectId, path);
      if (existing?.kind === 'directory') return fail(`touch: ${args[0]}: is a directory.`);
      await putFile(existing ? { ...existing, updatedAt: new Date().toISOString() } : makeFile(projectId, path, '', 'file'));
      return ok(existing ? `Updated ${path}` : `Created virtual file ${path}`);
    }
    case 'rm': {
      if (!args[0]) return fail('rm: missing operand. Usage: rm <path>');
      const path = resolveVirtualPath(cwd, args[0]);
      if (path === null) return fail(`rm: ${args[0]}: path escapes the virtual root.`);
      const file = await getFile(projectId, path);
      if (!file) return fail(`rm: ${args[0]}: no such file or directory.`);
      if (file.kind === 'directory') {
        const children = await listFiles(projectId);
        if (children.some((child) => child.path.startsWith(`${path}/`))) {
          return fail(`rm: ${args[0]}: directory is not empty.`);
        }
      }
      await deleteFile(projectId, path);
      return ok(`Removed ${path}`);
    }
    case 'clear':
      return ok('');
    case 'date':
      return ok(new Date().toISOString());
    case 'whoami':
      return ok('guest (local, no account required)');
    case 'skills': {
      const documents: VirtualFile[] = (await listFiles(projectId)).filter((file) =>
        file.path.toLowerCase().endsWith('skill.md'),
      );
      if (documents.length === 0) return ok('No SKILL.md documents in this workspace.');
      return ok(
        documents
          .map((file) => {
            const heading = file.content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'untitled';
            return `${file.path} — ${heading}`;
          })
          .join('\n'),
      );
    }
  }
}

export class VirtualShellAdapter implements ExecutionAdapter {
  readonly id = SHELL_ADAPTER_ID;
  readonly requiredScopes: PermissionScope[] = ['execution', 'workspace.read', 'workspace.write'];

  describe(): AdapterDescription {
    return {
      id: this.id,
      name: 'Virtual Shell',
      sandboxed: true,
      scopes: [...this.requiredScopes],
      limitations: SHELL_LIMITATIONS,
    };
  }

  async plan(input: ExecutionInput): Promise<ExecutionPlan> {
    const parsed = parseCommand(input.command);
    const cwd = input.cwd ?? '';
    const first = parsed.args[0];
    const resolved = first ? resolveVirtualPath(cwd, first) : null;
    // Show the exact operand even when it is invalid, so approval prompts never hide the target.
    const target = resolved === null && first ? first : (resolved ?? cwd) || '/';
    const destructive = parsed.command === 'rm';
    const mutates = MUTATING.has(parsed.command);
    const result: ManagedPlan = {
      adapterId: this.id,
      steps: stepsFor(parsed.command, target, parsed.error),
      requiredScopes: parsed.error || !isAllowedCommand(parsed.command) ? ['execution'] : scopesFor(parsed.command),
      target,
      parsed,
      destructive,
      mutates,
      cwd,
    };
    return result;
  }

  async execute(plan: ExecutionPlan, ctx: ExecutionContext): Promise<ExecutionOutput> {
    const managed = managedPlan(plan);
    const parsed = managed.parsed ?? parseCommand('');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const finish = (result: DispatchResult): ExecutionOutput => ({
      ...result,
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    if (parsed.error) return finish({ stdout: '', stderr: parsed.error, exitCode: 2 });
    if (!isAllowedCommand(parsed.command)) {
      return finish({
        stdout: '',
        stderr: `Unknown command "${parsed.command}". Allowed commands: ${ALLOWED_COMMANDS.join(', ')}. Type help for details.`,
        exitCode: 127,
      });
    }

    for (const scope of plan.requiredScopes) {
      const allowed = await ctx.approved(scope, plan.target);
      if (!allowed) {
        return finish({
          stdout: '',
          stderr: `Permission denied: ${scope} on ${plan.target}. No workspace state was changed.`,
          exitCode: 126,
        });
      }
    }

    try {
      return finish(await dispatch(parsed, ctx.workspaceId, managed.cwd ?? ''));
    } catch (error) {
      return finish({
        stdout: '',
        stderr: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      });
    }
  }

  async verify(plan: ExecutionPlan, output: ExecutionOutput): Promise<VerificationReport> {
    const managed = managedPlan(plan);
    const parsed = managed.parsed ?? parseCommand('');
    const baseline = managed.baseline ?? {};
    const after = managed.projectId ? await snapshotFiles(managed.projectId) : {};
    return buildVerificationReport(
      output,
      verifyStateTransition(baseline, after, parsed.command, plan.target),
    );
  }
}
