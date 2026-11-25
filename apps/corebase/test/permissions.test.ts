import type { Grant } from '@oneorigin/contracts';
import { describe, expect, it } from 'vitest';
import { evaluatePermission, isGrantActive } from '../src/lib/helpers';

const now = '2026-06-01T00:00:00.000Z';
const resource = 'workspace:proj_1:notes/draft.md';

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'grant-1',
    subject: 'session:s1',
    capabilityId: 'oneorigin.corebase.shell.rm',
    capabilityVersion: '0.0.1',
    scope: 'workspace.write',
    resource,
    decision: 'allow',
    grantedAt: '2026-05-31T00:00:00.000Z',
    reason: 'Human approval in UI',
    ...overrides,
  };
}

function decide(grants: Grant[], approvalsEnabled = true) {
  return evaluatePermission({
    grants,
    subject: 'session:s1',
    capabilityId: 'oneorigin.corebase.shell.rm',
    capabilityVersion: '0.0.1',
    scope: 'workspace.write',
    resource,
    now,
    approvalsEnabled,
  });
}

describe('permission decisions', () => {
  it('defaults to requesting approval when no active grant exists', () => {
    expect(decide([])).toMatchObject({ kind: 'approval-required' });
  });

  it('allows only an active, matching, unexpired grant', () => {
    expect(decide([grant()])).toMatchObject({ kind: 'allow' });
    expect(decide([grant({ expiresAt: '2026-05-31T01:00:00.000Z' })])).toMatchObject({ kind: 'approval-required' });
    expect(decide([grant({ revokedAt: '2026-05-31T02:00:00.000Z' })])).toMatchObject({ kind: 'approval-required' });
  });

  it('honours an explicit deny even when an allow grant exists', () => {
    const denied = grant({ id: 'deny-1', decision: 'deny', reason: 'Policy forbids this target.' });
    const decision = decide([grant(), denied]);
    expect(decision).toMatchObject({ kind: 'deny' });
    if (decision.kind === 'deny') expect(decision.reason).toMatch(/policy forbids/i);
  });

  it('denies silently when approval prompts are disabled and no grant exists', () => {
    expect(decide([], false)).toMatchObject({ kind: 'deny' });
  });

  it('requires the exact resource and capability version', () => {
    expect(decide([grant({ resource: 'workspace:proj_1' })])).toMatchObject({ kind: 'approval-required' });
    expect(decide([grant({ capabilityVersion: '0.0.2' })])).toMatchObject({ kind: 'approval-required' });
    expect(isGrantActive(grant({ decision: 'deny' }), Date.parse(now))).toBe(false);
  });
});
