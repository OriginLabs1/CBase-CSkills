import { describe, expect, it } from 'vitest';
import { contentHash } from '@oneorigin/contracts';
import {
  MemoryPersistenceAdapter,
  createEvent,
  mergeEvents,
  validateChangeEvent,
  validateSyncCheckpoint,
  verifyEventChain,
  type ChangeEvent,
} from './index.js';

const at = (n: number) => `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`;
const hash = `sha256:${'a'.repeat(64)}`;

function event(id: string, sequence: number, previousEventId?: string, valueHash = hash): ChangeEvent {
  return createEvent({
    id, namespace: 'consents', key: `consent.${id}`, operation: 'put',
    sequence, actor: 'test', at: at(sequence), previousEventId, valueHash,
  });
}

describe('change event contracts', () => {
  it('validates a well-formed event and checkpoint', async () => {
    const checkpoint = {
      schema: 'oneorigin.checkpoint/v0.0.2',
      storeId: 'edge-1',
      lastSequence: 1,
      headHash: await contentHash(new TextEncoder().encode('head')),
      updatedAt: at(1),
    };
    expect(validateChangeEvent(event('event.1', 1)).ok).toBe(true);
    expect(validateSyncCheckpoint(checkpoint).ok).toBe(true);
  });

  it('rejects a put without a value hash', () => {
    const result = validateChangeEvent({ ...event('event.1', 1), valueHash: undefined });
    expect(result.diagnostics.map((d) => d.code)).toContain('EV013');
  });

  it('detects broken chains and sequence gaps', () => {
    expect(verifyEventChain([event('event.1', 1), event('event.2', 2, 'event.1')]).ok).toBe(true);
    const broken = verifyEventChain([event('event.1', 1), event('event.2', 3, 'wrong')]);
    expect(broken.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(['CHN003', 'CHN004']));
  });

  it('surfaces conflicting writes instead of resolving them silently', () => {
    const local = [event('event.1', 1, undefined, hash)];
    const remote = [event('event.1', 1, undefined, `sha256:${'b'.repeat(64)}`)];
    const merged = mergeEvents(local, remote);
    expect(merged.events).toHaveLength(1);
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0].namespace).toBe('consents');
  });
});

describe('reference persistence adapter', () => {
  it('behaves identically across deployment kinds', async () => {
    const edge = new MemoryPersistenceAdapter('edge', 'edge-local');
    const sql = new MemoryPersistenceAdapter('sql', 'oneorigin-postgresql');
    for (const adapter of [edge, sql]) {
      await adapter.put('profiles', 'ada', new TextEncoder().encode('Ada'));
      expect(new TextDecoder().decode(await adapter.get('profiles', 'ada'))).toBe('Ada');
      expect(await adapter.list('profiles', 'a')).toEqual(['ada']);
      expect((await adapter.eventsAfter(0)).map((e) => e.sequence)).toEqual([1]);
      const checkpoint = await adapter.checkpoint();
      expect(checkpoint.lastSequence).toBe(1);
      expect(validateSyncCheckpoint(checkpoint).ok).toBe(true);
    }
  });

  it('clones bytes and journals deletes', async () => {
    const adapter = new MemoryPersistenceAdapter();
    const value = new Uint8Array([1, 2, 3]);
    await adapter.put('settings', 'flags', value);
    value[0] = 9;
    expect([...((await adapter.get('settings', 'flags')) ?? [])]).toEqual([1, 2, 3]);
    await adapter.delete('settings', 'flags');
    expect(await adapter.get('settings', 'flags')).toBeUndefined();
    expect((await adapter.eventsAfter(0)).map((e) => e.operation)).toEqual(['put', 'delete']);
    expect(verifyEventChain(await adapter.eventsAfter(0)).ok).toBe(true);
  });

  it('rejects journal forks', async () => {
    const adapter = new MemoryPersistenceAdapter();
    await expect(adapter.append(event('event.5', 5))).rejects.toThrow(/does not continue the local journal/);
  });

  it('closes cleanly', async () => {
    const adapter = new MemoryPersistenceAdapter();
    await adapter.close();
    await expect(adapter.put('settings', 'x', new Uint8Array())).rejects.toThrow(/closed/);
  });
});
