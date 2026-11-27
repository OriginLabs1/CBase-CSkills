/** Browser-facing contracts for the optional v0.0.2 service. */

import type { ConsentGrant, Session } from '@oneorigin/identity';

export interface ServiceConfig {
  /** Default points at the local optional service; guest mode never calls it. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Requests to the optional service are bounded so offline guest mode never stalls. */
  timeoutMs?: number;
}

export interface LocalIdentity {
  id: string;
  createdAt: string;
  /** Always false in this browser build: a local id is not a service account. */
  registered: false;
}

export interface IdentityStatus {
  mode: 'guest' | 'connected';
  identityId: string;
  session?: Session;
}

export interface RequestCodeResult {
  challengeId: string;
  expiresAt: string;
}

export interface ObservabilitySnapshot {
  status: 'live' | 'offline' | 'stale';
  product: 'corebase' | 'coreskills';
  at: string;
  consentGrantId: string;
  health?: Record<string, unknown>;
}

export type ConsentAction = 'verify' | 'disclose' | 'accept' | 'decline' | 'revoke' | 'expire';

export interface ConsentActionBody {
  verificationId?: string;
  scopeDisclosure?: string;
}

export type { ConsentGrant, Session };
