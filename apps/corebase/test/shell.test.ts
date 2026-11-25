import { describe, expect, it } from 'vitest';
import { managedPlan } from '../src/lib/execution/plan';
import { VirtualShellAdapter } from '../src/lib/execution/virtual-shell';

describe('virtual shell adapter', () => {
  const adapter = new VirtualShellAdapter();

  it('declares an honest sandboxed description with required scopes', () => {
    const description = adapter.describe();
    expect(description.id).toBe('virtual-shell');
    expect(description.sandboxed).toBe(true);
    expect(description.scopes).toEqual(['execution', 'workspace.read', 'workspace.write']);
    expect(description.limitations).toMatch(/no process spawning/i);
  });

  it('plans read-only and mutating commands with different least-authority scopes', async () => {
    const read = managedPlan(await adapter.plan({ command: 'cat notes/ideas.md', cwd: '' }));
    expect(read.requiredScopes).toEqual(['execution', 'workspace.read']);
    expect(read.target).toBe('notes/ideas.md');
    expect(read.destructive).toBe(false);

    const write = managedPlan(await adapter.plan({ command: 'rm notes/ideas.md', cwd: '' }));
    expect(write.requiredScopes).toEqual(['execution', 'workspace.write']);
    expect(write.destructive).toBe(true);
    expect(write.steps.join(' ')).toMatch(/approval/i);
  });

  it('fails unknown commands with a helpful allowlist message and a non-zero exit code', async () => {
    const plan = await adapter.plan({ command: 'curl https://example.com' });
    expect(plan.steps[0]).toMatch(/allowlist/i);
    const output = await adapter.execute(plan, {
      workspaceId: 'proj_1',
      sessionId: 's1',
      approved: async () => true,
    });
    expect(output.exitCode).toBe(127);
    expect(output.stderr).toContain('help, pwd, ls, cat, echo');
    expect(output.stderr).toMatch(/type help/i);
  });

  it('refuses execution when the authorization context denies a required scope', async () => {
    const plan = await adapter.plan({ command: 'mkdir drafts' });
    const output = await adapter.execute(plan, {
      workspaceId: 'proj_1',
      sessionId: 's1',
      approved: async () => false,
    });
    expect(output.exitCode).toBe(126);
    expect(output.stderr).toMatch(/permission denied/i);
    expect(output.stdout).toBe('');
  });
});
