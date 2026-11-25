import { describe, expect, it } from 'vitest';
import {
  buildFileTree,
  buildVerificationReport,
  flattenTree,
  parseCommand,
  resolveVirtualPath,
  tokenize,
  verifyStateTransition,
} from '../src/lib/helpers';

describe('command parsing', () => {
  it('tokenizes quoted arguments without evaluating shell syntax', () => {
    const parsed = parseCommand('ECHO "hello world" \'a b\' $(whoami)');
    expect(parsed.command).toBe('echo');
    expect(parsed.args).toEqual(['hello world', 'a b', '$(whoami)']);
    expect(parsed.error).toBeUndefined();
  });

  it('rejects unterminated quotes and empty input', () => {
    expect(tokenize('echo "broken')).toBeNull();
    expect(parseCommand('echo "broken').error).toMatch(/unterminated quote/i);
    expect(parseCommand('   ').error).toMatch(/enter a command/i);
  });
});

describe('virtual path resolution', () => {
  it('resolves relative paths against cwd and collapses dot segments', () => {
    expect(resolveVirtualPath('notes', './ideas/../draft.md')).toBe('notes/draft.md');
    expect(resolveVirtualPath('notes', '/src/app.js')).toBe('src/app.js');
  });

  it('refuses to escape the sandbox root or contain NUL', () => {
    expect(resolveVirtualPath('notes', '../../etc/passwd')).toBeNull();
    expect(resolveVirtualPath('', `a/${String.fromCharCode(0)}/b`)).toBeNull();
  });
});

describe('file tree', () => {
  it('builds a sorted tree with directories before files', () => {
    const rows = flattenTree(
      buildFileTree([
        { path: 'b.js', kind: 'file' },
        { path: 'notes/a.md', kind: 'file' },
        { path: 'a.md', kind: 'file' },
      ]),
    );
    expect(rows.map((row) => `${row.node.path}${row.node.isDirectory ? '/' : ''}`)).toEqual([
      'notes/',
      'notes/a.md',
      'a.md',
      'b.js',
    ]);
  });
});

describe('verification logic', () => {
  const output = (exitCode: number) => ({
    stdout: 'ok',
    stderr: '',
    exitCode,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:00.001Z',
  });

  it('detects unexpected state changes from read-only commands', () => {
    const check = verifyStateTransition({ 'a.md': 'file:one' }, { 'a.md': 'file:two' }, 'cat', 'a.md');
    expect(check.passed).toBe(false);
    expect(check.name).toBe('expectedState');
  });

  it('accepts the exact intended mutation and no unrelated changes', () => {
    const check = verifyStateTransition({}, { 'draft.md': 'file:' }, 'touch', 'draft.md');
    expect(check.passed).toBe(true);
    const removed = verifyStateTransition({ 'draft.md': 'file:' }, {}, 'rm', 'draft.md');
    expect(removed.passed).toBe(true);
  });

  it('fails the result when exit code is non-zero even if state is correct', () => {
    const report = buildVerificationReport(
      output(127),
      verifyStateTransition({}, {}, 'bogus', '/'),
    );
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === 'exitCodeZero')?.passed).toBe(false);
  });

  it('passes only when every named check passes', () => {
    const report = buildVerificationReport(output(0), verifyStateTransition({}, {}, 'pwd', '/'));
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(['exitCodeZero', 'outputCaptured', 'expectedState']);
  });
});
