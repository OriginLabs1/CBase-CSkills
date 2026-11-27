import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifyEventChain, validateSyncCheckpoint, type ChangeEvent } from '@oneorigin/persistence';
import { PostgresPersistenceAdapter, type SqlClient, type SqlResult } from './index.js';

/** Minimal query double: enough to prove the adapter's contract-level behavior. */
class StubClient implements SqlClient {
  readonly records = new Map<string, Map<string, Uint8Array>>();
  readonly events: ChangeEvent[] = [];
  readonly queries: string[] = [];
  ended = false;

  async query(text: string, params: readonly unknown[] = []): Promise<SqlResult> {
    this.queries.push(text);
    const [namespace, key] = [String(params[0] ?? ''), String(params[1] ?? '')];
    if (text.startsWith('SELECT value')) {
      const value = this.records.get(namespace)?.get(key);
      return { rows: value ? [{ value }] : [] };
    }
    if (text.startsWith('INSERT INTO oneorigin_records')) {
      const store = this.records.get(namespace) ?? new Map<string, Uint8Array>();
      store.set(key, params[2] as Uint8Array);
      this.records.set(namespace, store);
      return { rows: [] };
    }
    if (text.startsWith('DELETE FROM oneorigin_records')) {
      const existed = this.records.get(namespace)?.delete(key) ?? false;
      return { rows: existed ? [{ key }] : [] };
    }
    if (text.startsWith('SELECT key')) {
      const prefix = String(params[1] ?? '').replace(/%$/, '');
      const keys = [...(this.records.get(namespace)?.keys() ?? [])].filter((value) => value.startsWith(prefix)).sort();
      return { rows: keys.map((value) => ({ key: value })) };
    }
    if (text.startsWith('SELECT event FROM oneorigin_events ORDER BY seq DESC')) {
      const last = this.events.at(-1);
      return { rows: last ? [{ event: last }] : [] };
    }
    if (text.startsWith('SELECT event FROM oneorigin_events WHERE seq')) {
      const after = Number(params[0]);
      const limit = params[1] === undefined ? undefined : Number(params[1]);
      const matching = this.events.filter((event) => event.sequence > after);
      return { rows: (limit === undefined ? matching : matching.slice(0, limit)).map((event) => ({ event })) };
    }
    if (text.startsWith('INSERT INTO oneorigin_events')) {
      this.events.push(JSON.parse(String(params[1])) as ChangeEvent);
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

describe('PostgreSQL adapter', () => {
  it('ships a schema with an append-only journal', () => {
    const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    expect(schema).toContain('oneorigin_records');
    expect(schema).toContain('oneorigin_events');
    expect(schema).toContain('PRIMARY KEY (namespace, key)');
    expect(schema).toContain('append-only');
  });

  it('matches the in-memory adapter contract', async () => {
    const client = new StubClient();
    const adapter = new PostgresPersistenceAdapter(client, {
      id: 'independent', kind: 'independent-postgresql',
    });
    const bytes = new TextEncoder().encode('Ada');
    await adapter.put('profiles', 'ada', bytes);
    expect(new TextDecoder().decode((await adapter.get('profiles', 'ada'))!)).toBe('Ada');
    expect(await adapter.list('profiles', 'a')).toEqual(['ada']);
    const checkpoint = await adapter.checkpoint();
    expect(checkpoint.lastSequence).toBe(1);
    expect(validateSyncCheckpoint(checkpoint).ok).toBe(true);
    expect(verifyEventChain(await adapter.eventsAfter(0)).ok).toBe(true);

    await adapter.delete('profiles', 'ada');
    expect(await adapter.get('profiles', 'ada')).toBeUndefined();
    expect((await adapter.eventsAfter(0)).map((event) => event.operation)).toEqual(['put', 'delete']);
    expect(verifyEventChain(await adapter.eventsAfter(0)).ok).toBe(true);
    await adapter.close();
    expect(client.ended).toBe(true);
  });

  it('does not journal a no-op delete', async () => {
    const adapter = new PostgresPersistenceAdapter(new StubClient());
    await adapter.delete('settings', 'missing');
    expect(await adapter.eventsAfter(0)).toEqual([]);
  });
});
