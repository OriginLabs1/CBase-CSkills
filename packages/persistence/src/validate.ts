import type { Diagnostic, ValidationReport } from '@oneorigin/contracts';
import { CHECKPOINT_SCHEMA, EVENT_SCHEMA, NAMESPACES, type ChangeEvent, type MergeConflict, type MergeResult, type SyncCheckpoint } from './types.js';

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHA_REF = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function report(diagnostics: Diagnostic[]): ValidationReport {
  return { ok: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

type Push = (code: string, path: string, message: string, severity?: Diagnostic['severity']) => void;

function timestamp(value: unknown, path: string, push: Push): void {
  if (typeof value !== 'string' || !RFC3339.test(value) || Number.isNaN(Date.parse(value))) {
    push('EV005', path, 'Timestamp must be RFC 3339 with an explicit offset.');
  }
}

export function validateChangeEvent(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('EV001', '/', 'Change event must be a JSON object.');
    return report(d);
  }
  if (value.schema !== EVENT_SCHEMA) push('EV002', '/schema', `schema must be "${EVENT_SCHEMA}".`);
  if (typeof value.id !== 'string' || !ID.test(value.id)) push('EV003', '/id', 'Invalid event id.');
  if (typeof value.namespace !== 'string' || value.namespace.length < 1 || value.namespace.length > 64 || value.namespace.includes('\0')) {
    push('EV004', '/namespace', 'Invalid namespace.');
  } else if (!NAMESPACES.includes(value.namespace as never)) {
    push('EV010', '/namespace', 'Custom namespace; ensure all deployments agree on it.', 'info');
  }
  if (typeof value.key !== 'string' || value.key.length < 1 || value.key.length > 512 || value.key.includes('\0')) {
    push('EV006', '/key', 'Invalid key.');
  }
  if (value.operation !== 'put' && value.operation !== 'delete') push('EV007', '/operation', 'operation must be put or delete.');
  if (!Number.isInteger(value.sequence) || (value.sequence as number) < 1) push('EV008', '/sequence', 'sequence must be a positive integer.');
  timestamp(value.at, '/at', push);
  if (typeof value.actor !== 'string' || value.actor.length < 1 || value.actor.length > 256) push('EV009', '/actor', 'actor must identify the writer.');
  if (value.valueHash !== undefined && (typeof value.valueHash !== 'string' || !SHA_REF.test(value.valueHash))) {
    push('EV011', '/valueHash', 'valueHash must be sha256:<64 hex chars>.');
  }
  if (value.previousEventId !== undefined && (typeof value.previousEventId !== 'string' || !ID.test(value.previousEventId))) {
    push('EV012', '/previousEventId', 'Invalid previous event id.');
  }
  if (value.operation === 'put' && value.valueHash === undefined) push('EV013', '/valueHash', 'A put event must include a value hash.');
  if (value.operation === 'delete' && value.valueHash !== undefined) push('EV014', '/valueHash', 'A delete event must not include a value hash.', 'warning');
  return report(d);
}

export function validateSyncCheckpoint(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('CP001', '/', 'Sync checkpoint must be a JSON object.');
    return report(d);
  }
  if (value.schema !== CHECKPOINT_SCHEMA) push('CP002', '/schema', `schema must be "${CHECKPOINT_SCHEMA}".`);
  if (typeof value.storeId !== 'string' || value.storeId.length < 1 || value.storeId.length > 256) push('CP003', '/storeId', 'Invalid storeId.');
  if (!Number.isInteger(value.lastSequence) || (value.lastSequence as number) < 0) push('CP004', '/lastSequence', 'lastSequence must be a non-negative integer.');
  if (typeof value.headHash !== 'string' || !SHA_REF.test(value.headHash)) push('CP005', '/headHash', 'headHash must be sha256:<64 hex chars>.');
  timestamp(value.updatedAt, '/updatedAt', push);
  return report(d);
}

/** Verifies local journal continuity; a break must be surfaced, never repaired. */
export function verifyEventChain(events: readonly ChangeEvent[]): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  const ids = new Set<string>();
  for (const [i, event] of events.entries()) {
    const shape = validateChangeEvent(event);
    for (const diagnostic of shape.diagnostics) {
      if (diagnostic.severity === 'error') push('CHN001', `/${i}${diagnostic.path}`, diagnostic.message);
    }
    if (ids.has(event.id)) push('CHN002', `/${i}/id`, 'Duplicate event id.');
    ids.add(event.id);
    if (event.sequence !== i + 1) push('CHN003', `/${i}/sequence`, `Expected sequence ${i + 1}, found ${event.sequence}.`);
    const expectedPrevious = i === 0 ? undefined : events[i - 1].id;
    if (event.previousEventId !== expectedPrevious) push('CHN004', `/${i}/previousEventId`, 'Event chain link does not match the previous event.');
  }
  return report(d);
}

/**
 * Deterministic union of two journals. Conflicts are surfaced for human
 * resolution rather than silently collapsed by last-write-wins.
 */
export function mergeEvents(local: readonly ChangeEvent[], remote: readonly ChangeEvent[]): MergeResult {
  const byId = new Map<string, ChangeEvent>();
  const conflicts: MergeConflict[] = [];
  for (const event of [...local, ...remote]) {
    const existing = byId.get(event.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      conflicts.push({
        namespace: event.namespace,
        key: event.key,
        sequence: event.sequence,
        eventIds: [existing.id, event.id],
      });
    } else if (!existing) {
      byId.set(event.id, event);
    }
  }

  const bySlot = new Map<string, ChangeEvent[]>();
  for (const event of byId.values()) {
    const slot = `${event.namespace}\u0000${event.key}\u0000${event.sequence}`;
    const list = bySlot.get(slot) ?? [];
    list.push(event);
    bySlot.set(slot, list);
  }
  for (const events of bySlot.values()) {
    if (events.length < 2) continue;
    const hashes = new Set(events.map((event) => event.valueHash ?? 'delete'));
    if (hashes.size > 1) {
      conflicts.push({
        namespace: events[0].namespace,
        key: events[0].key,
        sequence: events[0].sequence,
        eventIds: events.map((event) => event.id).sort(),
      });
    }
  }

  const events = [...byId.values()].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  conflicts.sort((a, b) => a.namespace.localeCompare(b.namespace)
    || a.key.localeCompare(b.key)
    || a.sequence - b.sequence
    || a.eventIds.join(',').localeCompare(b.eventIds.join(',')));
  return { events, conflicts };
}

export function isSyncCheckpoint(value: unknown): value is SyncCheckpoint {
  return validateSyncCheckpoint(value).ok;
}

export function isChangeEvent(value: unknown): value is ChangeEvent {
  return validateChangeEvent(value).ok;
}
