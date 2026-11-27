import { canonicalJson, contentHash, randomId } from '@oneorigin/contracts';
import {
  CHECKPOINT_SCHEMA,
  EVENT_SCHEMA,
  type ChangeEvent,
  type ChangeOperation,
  type PersistenceAdapter,
  type StoreKind,
  type SyncCheckpoint,
} from './types.js';
import { validateChangeEvent } from './validate.js';

/** Reference helper so every adapter builds journals with identical shapes. */
export function createEvent(input: {
  namespace: string;
  key: string;
  operation: ChangeOperation;
  sequence: number;
  actor: string;
  at?: string;
  valueHash?: string;
  previousEventId?: string;
  id?: string;
}): ChangeEvent {
  return {
    schema: EVENT_SCHEMA,
    id: input.id ?? randomId(),
    namespace: input.namespace,
    key: input.key,
    operation: input.operation,
    sequence: input.sequence,
    at: input.at ?? new Date().toISOString(),
    actor: input.actor,
    valueHash: input.operation === 'put' ? input.valueHash : undefined,
    previousEventId: input.previousEventId,
  };
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

/** Conformance reference implementation; production adapters mirror its semantics. */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  readonly id: string;
  readonly kind: StoreKind;
  private readonly values = new Map<string, Map<string, Uint8Array>>();
  private readonly events: ChangeEvent[] = [];
  private closed = false;

  constructor(id = 'memory', kind: StoreKind = 'edge-local') {
    this.id = id;
    this.kind = kind;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error(`Adapter ${this.id} is closed.`);
  }

  async get(namespace: string, key: string): Promise<Uint8Array | undefined> {
    this.assertOpen();
    const value = this.values.get(namespace)?.get(key);
    return value ? cloneBytes(value) : undefined;
  }

  async put(namespace: string, key: string, value: Uint8Array): Promise<void> {
    this.assertOpen();
    const hash = await contentHash(value);
    const last = this.events[this.events.length - 1];
    await this.append(createEvent({
      namespace, key, operation: 'put', actor: this.id,
      sequence: this.events.length + 1, previousEventId: last?.id, valueHash: hash,
    }));
    const store = this.values.get(namespace) ?? new Map<string, Uint8Array>();
    store.set(key, cloneBytes(value));
    this.values.set(namespace, store);
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.assertOpen();
    if (!this.values.get(namespace)?.has(key)) return;
    const last = this.events[this.events.length - 1];
    await this.append(createEvent({
      namespace, key, operation: 'delete', actor: this.id,
      sequence: this.events.length + 1, previousEventId: last?.id,
    }));
    this.values.get(namespace)?.delete(key);
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    this.assertOpen();
    return [...(this.values.get(namespace)?.keys() ?? [])]
      .filter((key) => prefix === undefined || key.startsWith(prefix))
      .sort();
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async append(event: ChangeEvent): Promise<void> {
    this.assertOpen();
    const shape = validateChangeEvent(event);
    if (!shape.ok) throw new Error(`Invalid change event: ${shape.diagnostics.map((d) => d.code).join(', ')}`);
    const last = this.events[this.events.length - 1];
    if (event.sequence !== this.events.length + 1 || event.previousEventId !== last?.id) {
      throw new Error('Change event does not continue the local journal.');
    }
    this.events.push({ ...event });
  }

  async eventsAfter(sequence: number, limit?: number): Promise<ChangeEvent[]> {
    this.assertOpen();
    const matching = this.events.filter((event) => event.sequence > sequence);
    return (limit === undefined ? matching : matching.slice(0, limit)).map((event) => ({ ...event }));
  }

  async checkpoint(): Promise<SyncCheckpoint> {
    this.assertOpen();
    const last = this.events[this.events.length - 1];
    const lastSequence = last?.sequence ?? 0;
    const headHash = await contentHash(new TextEncoder().encode(canonicalJson({
      lastSequence, lastEventId: last?.id ?? null, storeId: this.id,
    })));
    return {
      schema: CHECKPOINT_SCHEMA,
      storeId: this.id,
      lastSequence,
      headHash,
      updatedAt: last?.at ?? new Date(0).toISOString(),
    };
  }
}
