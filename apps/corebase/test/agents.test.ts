import { describe, expect, it } from 'vitest';
import { offlinePlanAdapter, remoteModelStub } from '../src/lib/agents';

describe('model adapters', () => {
  it('produces a deterministic, offline, inspectable plan', async () => {
    const intent = { goal: 'Draft documentation for the workspace' };
    const first = await offlinePlanAdapter.plan(intent);
    const second = await offlinePlanAdapter.plan(intent);
    expect(first).toEqual(second);
    expect(first.requiredScopes).toEqual([]);
    expect(first.steps.length).toBeGreaterThanOrEqual(3);
    expect(first.notes.join(' ')).toMatch(/no credentials/i);
    expect(offlinePlanAdapter.describe()).toMatchObject({ status: 'ready', configured: true });
  });

  it('keeps the remote adapter clearly disabled and never calls it', async () => {
    expect(remoteModelStub.describe()).toMatchObject({ status: 'disabled', configured: false });
    await expect(remoteModelStub.plan({ goal: 'anything' })).rejects.toThrow(/not configured/i);
  });
});
