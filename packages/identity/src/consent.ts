import type { ConsentEvent, ConsentGrant, ConsentStatus } from './types.js';

/**
 * Invitation → identity verification → scope disclosure → accept/decline
 * → authorization → expiry/revocation. Decline grants no access, and no
 * transition may skip the disclosure step.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<ConsentStatus, readonly ConsentEvent[]>> = {
  invited: ['verify', 'decline'],
  'identity-verified': ['disclose', 'decline'],
  'scope-disclosed': ['accept', 'decline'],
  active: ['expire', 'revoke'],
  declined: [],
  expired: [],
  revoked: [],
};

export type TransitionResult =
  | { ok: true; grant: ConsentGrant }
  | { ok: false; reason: string };

export function transitionConsent(grant: ConsentGrant, event: ConsentEvent, at: string): TransitionResult {
  if (!ALLOWED_TRANSITIONS[grant.status].includes(event)) {
    return { ok: false, reason: `Cannot ${event} a grant in status "${grant.status}".` };
  }
  if (event === 'verify' && !grant.verificationId) {
    return { ok: false, reason: 'Identity verification requires a verificationId.' };
  }
  if (event === 'disclose' && grant.scopeDisclosure.trim().length === 0) {
    return { ok: false, reason: 'Scope disclosure must be shown before acceptance.' };
  }
  if (event === 'expire' && !grant.expiresAt) {
    return { ok: false, reason: 'Expiry requires an expiresAt timestamp.' };
  }

  switch (event) {
    case 'verify':
      return { ok: true, grant: { ...grant, status: 'identity-verified' } };
    case 'disclose':
      return { ok: true, grant: { ...grant, status: 'scope-disclosed' } };
    case 'accept':
      return { ok: true, grant: { ...grant, status: 'active', acceptedAt: at } };
    case 'decline':
      return { ok: true, grant: { ...grant, status: 'declined', declinedAt: at } };
    case 'expire':
      return { ok: true, grant: { ...grant, status: 'expired' } };
    case 'revoke':
      return { ok: true, grant: { ...grant, status: 'revoked', revokedAt: at } };
  }
}

/** Expiry is effective without a background job. */
export function effectiveConsentStatus(grant: ConsentGrant, now: string): ConsentStatus {
  if (grant.status === 'active' && grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) {
    return 'expired';
  }
  return grant.status;
}

export function isConsentActive(grant: ConsentGrant, now: string): boolean {
  return effectiveConsentStatus(grant, now) === 'active';
}

/** Created on acceptance: the auditable authorization record for access. */
export function acceptanceRecord(grant: ConsentGrant): Omit<ConsentGrant, 'status' | 'acceptedAt'> & {
  status: 'active';
  acceptedAt: string;
} {
  if (grant.status !== 'active' || !grant.acceptedAt) {
    throw new Error('acceptanceRecord requires an accepted grant.');
  }
  return { ...grant, status: 'active', acceptedAt: grant.acceptedAt };
}
