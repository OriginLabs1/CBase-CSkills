/**
 * PostgreSQL implementation of PersistenceAdapter. The only requirement is an
 * injected client with a parameterized `query` method, so deployments can use
 * `pg`, a pool, a proxy or a test double without changing record contracts.
 */

import { base64ToBytes, canonicalJson, contentHash } from '@oneorigin/contracts';
import {
  CHECKPOINT_SCHEMA,
  EVENT_SCHEMA,
  createEvent,
  validateChangeEvent,
  type ChangeEvent,
  type PersistenceAdapter,
  type StoreKind,
  type SyncCheckpoint,
} from '@oneorigin/persistence';

export interface SqlResult {
  rows: Array<Record<string, unknown>>;
}

export interface SqlClient {
  query(text: string, params?: readonly unknown[]): Promise<SqlResult>;
  end?(): Promise<void>;
}

function toBytes(value: unknown): Uint8Array | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return base64ToBytes(value);
  if (Array.isArray(value)) return new Uint8Array(value as number[]);
  return undefined;
}

function toEvent(value: unknown): ChangeEvent | undefined {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ChangeEvent;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object' && value !== null) return value as ChangeEvent;
  return undefined;
}

export class PostgresPersistenceAdapter implements PersistenceAdapter {
  readonly id: string;
  readonly kind: StoreKind;

  constructor(
    readonly client: SqlClient,
    options: { id?: string; kind?: Extract<StoreKind, 'oneorigin-postgresql' | 'independent-postgresql'> } = {},
  ) {
    this.id = options.id ?? 'postgresql';
    this.kind = options.kind ?? 'oneorigin-postgresql';
  }

  async get(namespace: string, key: string): Promise<Uint8Array | undefined> {
    const result = await this.client.query(
      'SELECT value FROM oneorigin_records WHERE namespace = $1 AND key = $2',
      [namespace, key],
    );
    return toBytes(result.rows[0]?.value);
  }

  async put(namespace: string, key: string, value: Uint8Array): Promise<void> {
    await this.client.query(
      `INSERT INTO oneorigin_records (namespace, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [namespace, key, value],
    );
    const head = await this.lastEvent();
    await this.append(createEvent({
      namespace, key, operation: 'put', actor: this.id,
      sequence: (head?.sequence ?? 0) + 1,
      previousEventId: head?.id,
      valueHash: await contentHash(value),
    }));
  }

  async delete(namespace: string, key: string): Promise<void> {
    const result = await this.client.query(
      'DELETE FROM oneorigin_records WHERE namespace = $1 AND key = $2 RETURNING key',
      [namespace, key],
    );
    if (result.rows.length === 0) return;
    const head = await this.lastEvent();
    await this.append(createEvent({
      namespace, key, operation: 'delete', actor: this.id,
      sequence: (head?.sequence ?? 0) + 1,
      previousEventId: head?.id,
    }));
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    const result = prefix === undefined
      ? await this.client.query('SELECT key FROM oneorigin_records WHERE namespace = $1 ORDER BY key', [namespace])
      : await this.client.query(
        'SELECT key FROM oneorigin_records WHERE namespace = $1 AND key LIKE $2 ORDER BY key',
        [namespace, `${prefix}%`],
      );
    return result.rows.map((row) => String(row.key));
  }

  async close(): Promise<void> {
    await this.client.end?.();
  }

  async append(event: ChangeEvent): Promise<void> {
    const shape = validateChangeEvent(event);
    if (!shape.ok) throw new Error(`Invalid change event: ${shape.diagnostics.map((d) => d.code).join(', ')}`);
    const head = await this.lastEvent();
    if (event.sequence !== (head?.sequence ?? 0) + 1 || event.previousEventId !== head?.id) {
      throw new Error('Change event does not continue the local journal.');
    }
    await this.client.query(
      'INSERT INTO oneorigin_events (seq, event) VALUES ($1, $2)',
      [event.sequence, JSON.stringify(event)],
    );
  }

  async eventsAfter(sequence: number, limit?: number): Promise<ChangeEvent[]> {
    const result = limit === undefined
      ? await this.client.query('SELECT event FROM oneorigin_events WHERE seq > $1 ORDER BY seq', [sequence])
      : await this.client.query('SELECT event FROM oneorigin_events WHERE seq > $1 ORDER BY seq LIMIT $2', [sequence, limit]);
    return result.rows.map((row) => toEvent(row.event)).filter((event): event is ChangeEvent => Boolean(event));
  }

  async checkpoint(): Promise<SyncCheckpoint> {
    const head = await this.lastEvent();
    const lastSequence = head?.sequence ?? 0;
    const headHash = await contentHash(new TextEncoder().encode(canonicalJson({
      lastSequence, lastEventId: head?.id ?? null, storeId: this.id,
    })));
    return {
      schema: CHECKPOINT_SCHEMA,
      storeId: this.id,
      lastSequence,
      headHash,
      updatedAt: head?.at ?? new Date(0).toISOString(),
    };
  }

  private async lastEvent(): Promise<ChangeEvent | undefined> {
    const result = await this.client.query('SELECT event FROM oneorigin_events ORDER BY seq DESC LIMIT 1');
    return toEvent(result.rows[0]?.event);
  }
}

/** Kept for parity with the in-memory conformance reference. */
export { EVENT_SCHEMA };
