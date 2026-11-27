import { hashIdentityId } from '@oneorigin/identity';
import type { LocalIdentity } from './types.js';

const STORAGE_KEY = 'oneorigin.local-identity/v0.0.2';

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isLocalIdentity(value: unknown): value is LocalIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LocalIdentity>;
  return /^urn:oneorigin:identity:[0-9a-f]{64}$/.test(candidate.id ?? '')
    && typeof candidate.createdAt === 'string'
    && candidate.registered === false;
}

/**
 * A stable, provider-independent id for provenance in guest mode. It is derived
 * locally from random material and never registered with a service.
 */
export async function getOrCreateLocalIdentity(): Promise<LocalIdentity> {
  const store = storage();
  if (store) {
    const raw = store.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isLocalIdentity(parsed)) return parsed;
      } catch {
        // Corrupt local data is replaced rather than trusted.
      }
    }
  }
  const entropy = new Uint8Array(32);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy);
  else entropy.set(Array.from({ length: 32 }, (_, i) => (Date.now() + i) & 0xff));
  const identity: LocalIdentity = {
    id: await hashIdentityId(Array.from(entropy, (byte) => byte.toString(16).padStart(2, '0')).join('')),
    createdAt: new Date().toISOString(),
    registered: false,
  };
  store?.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function readLocalIdentity(): LocalIdentity | undefined {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLocalIdentity(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function clearLocalIdentity(): void {
  storage()?.removeItem(STORAGE_KEY);
}

/** Short display form that never suggests the full id is memorable. */
export function shortIdentity(id: string): string {
  return `${id.slice(0, 24)}…${id.slice(-6)}`;
}
