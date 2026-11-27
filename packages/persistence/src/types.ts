/** Persistence and synchronization contracts. See docs/specs/11. */

export const EVENT_SCHEMA = 'oneorigin.event/v0.0.2' as const;
export const CHECKPOINT_SCHEMA = 'oneorigin.checkpoint/v0.0.2' as const;
export const GENESIS_HASH = '0'.repeat(64);

/** All three deployment models implement the same adapter contract. */
export type StoreKind = 'edge-local' | 'oneorigin-postgresql' | 'independent-postgresql';

export const NAMESPACES = [
  // v0.0.1
  'skills', 'skill-versions', 'projects', 'files', 'sessions', 'checkpoints',
  'audit', 'grants', 'settings',
  // v0.0.2
  'identities', 'credentials', 'profiles', 'organizations', 'memberships',
  'roles', 'invitations', 'consents', 'verifications', 'templates',
  'template-versions', 'events', 'sync',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export type ChangeOperation = 'put' | 'delete';

/** Append-only journal entry; consent and audit records must never be overwritten silently. */
export interface ChangeEvent {
  schema: typeof EVENT_SCHEMA;
  id: string;
  namespace: string;
  key: string;
  operation: ChangeOperation;
  sequence: number;
  at: string;
  actor: string;
  /** `sha256:<hex>` of the value written, absent for deletes. */
  valueHash?: string;
  /** Previous event id; absent for the first event in a store. */
  previousEventId?: string;
}

export interface SyncCheckpoint {
  schema: typeof CHECKPOINT_SCHEMA;
  storeId: string;
  lastSequence: number;
  /** `sha256:<hex>` over the journal head at `lastSequence`. */
  headHash: string;
  updatedAt: string;
}

export interface PersistenceAdapter {
  id: string;
  kind: StoreKind;
  get(namespace: string, key: string): Promise<Uint8Array | undefined>;
  put(namespace: string, key: string, value: Uint8Array): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  list(namespace: string, prefix?: string): Promise<string[]>;
  close(): Promise<void>;
  append(event: ChangeEvent): Promise<void>;
  eventsAfter(sequence: number, limit?: number): Promise<ChangeEvent[]>;
  checkpoint(): Promise<SyncCheckpoint>;
}

export interface MergeConflict {
  namespace: string;
  key: string;
  sequence: number;
  eventIds: string[];
}

export interface MergeResult {
  events: ChangeEvent[];
  conflicts: MergeConflict[];
}
