import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, makeAuditEntry, verifyAuditChain } from '../src/lib/execution/audit';

const at = '2026-01-01T00:00:00.000Z';

async function chain() {
  const first = await makeAuditEntry({
    seq: 1,
    at,
    stage: 'intent',
    actor: 'guest',
    summary: 'Intent: help',
    data: { raw: 'help' },
    previousHash: GENESIS_HASH,
  });
  const second = await makeAuditEntry({
    seq: 2,
    at,
    stage: 'plan',
    actor: 'guest',
    summary: 'Plan: list commands',
    data: { steps: ['List bounded commands'] },
    previousHash: first.entryHash,
  });
  return [first, second];
}

describe('hash-chained audit log', () => {
  it('starts from the genesis hash and verifies a well-formed chain', async () => {
    const entries = await chain();
    expect(entries[0].previousHash).toBe('0'.repeat(64));
    const report = await verifyAuditChain(entries);
    expect(report).toMatchObject({ ok: true, entries: 2, head: entries[1].entryHash });
    expect(report.breakAt).toBeUndefined();
  });

  it('surfaces tampered content as a break instead of repairing it', async () => {
    const entries = await chain();
    const tampered = { ...entries[1], summary: 'Plan: something else' };
    const report = await verifyAuditChain([entries[0], tampered]);
    expect(report.ok).toBe(false);
    expect(report.breakAt).toBe(2);
    expect(report.reason).toMatch(/hash mismatch/i);
  });

  it('detects a broken previous-hash link and a sequence gap', async () => {
    const entries = await chain();
    const relinked = { ...entries[1], previousHash: GENESIS_HASH };
    expect((await verifyAuditChain([entries[0], relinked])).breakAt).toBe(2);

    const gap = await makeAuditEntry({
      seq: 4,
      at,
      stage: 'result',
      actor: 'guest',
      summary: 'Orphan entry',
      previousHash: entries[1].entryHash,
    });
    const report = await verifyAuditChain([...entries, gap]);
    expect(report.ok).toBe(false);
    expect(report.breakAt).toBe(4);
    expect(report.reason).toMatch(/sequence gap/i);
  });
});
