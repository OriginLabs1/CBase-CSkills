import { canonicalJson, type AuditEntry, type AuditStage } from '@oneorigin/contracts';
import { sha256Hex } from '@oneorigin/skill-kit';
import type { ChainReport } from '../types';

export const GENESIS_HASH = '0'.repeat(64);

const encoder = new TextEncoder();

export interface NewAuditEntry {
  seq: number;
  at: string;
  stage: AuditStage;
  actor: string;
  capabilityId?: string;
  summary: string;
  data?: Record<string, unknown>;
  previousHash: string;
}

/** entryHash = sha256(canonical(entry without entryHash) + previousEntryHash). */
export async function hashAuditEntry(entry: Omit<AuditEntry, 'entryHash'>): Promise<string> {
  return sha256Hex(encoder.encode(canonicalJson(entry) + entry.previousHash));
}

export async function makeAuditEntry(input: NewAuditEntry): Promise<AuditEntry> {
  const unsigned: Omit<AuditEntry, 'entryHash'> = {
    seq: input.seq,
    at: input.at,
    stage: input.stage,
    actor: input.actor,
    capabilityId: input.capabilityId,
    summary: input.summary,
    data: input.data,
    previousHash: input.previousHash,
  };
  return { ...unsigned, entryHash: await hashAuditEntry(unsigned) };
}

/**
 * Verifies sequence, linkage and entry hashes. A break is reported, never repaired:
 * callers must surface it to the human reader.
 */
export async function verifyAuditChain(entries: AuditEntry[]): Promise<ChainReport> {
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  let expectedPrevious = GENESIS_HASH;
  let expectedSeq = 1;

  for (const entry of ordered) {
    if (entry.seq !== expectedSeq) {
      return {
        ok: false,
        head: ordered.at(-1)?.entryHash ?? GENESIS_HASH,
        entries: ordered.length,
        breakAt: entry.seq,
        reason: `Sequence gap: expected ${expectedSeq}, found ${entry.seq}.`,
      };
    }
    if (entry.previousHash !== expectedPrevious) {
      return {
        ok: false,
        head: ordered.at(-1)?.entryHash ?? GENESIS_HASH,
        entries: ordered.length,
        breakAt: entry.seq,
        reason: 'Previous-hash mismatch: the chain was altered or truncated.',
      };
    }
    const { entryHash, ...unsigned } = entry;
    if ((await hashAuditEntry(unsigned)) !== entryHash) {
      return {
        ok: false,
        head: ordered.at(-1)?.entryHash ?? GENESIS_HASH,
        entries: ordered.length,
        breakAt: entry.seq,
        reason: 'Entry hash mismatch: stored content does not match its hash.',
      };
    }
    expectedPrevious = entryHash;
    expectedSeq += 1;
  }

  return {
    ok: true,
    head: expectedPrevious,
    entries: ordered.length,
  };
}
