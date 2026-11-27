import { describe, expect, it } from 'vitest';
import {
  acceptanceRecord,
  effectiveConsentStatus,
  isConsentActive,
  transitionConsent,
} from './consent.js';
import type { ConsentGrant } from './types.js';

const at = (day: number) => `2026-01-0${day}T00:00:00Z`;
const base: ConsentGrant = {
  schema: 'oneorigin.consent/v0.0.2',
  id: 'consent.1',
  kind: 'observability',
  subjectIdentityId: `urn:oneorigin:identity:${'a'.repeat(64)}`,
  granteeIdentityId: `urn:oneorigin:identity:${'b'.repeat(64)}`,
  inviterIdentityId: `urn:oneorigin:identity:${'a'.repeat(64)}`,
  application: 'corecenter',
  purpose: 'Health diagnostics',
  dataCategories: ['application-health'],
  operations: ['read'],
  scopeDisclosure: 'Operational metadata only.',
  status: 'invited',
  createdAt: at(1),
};

describe('consent lifecycle', () => {
  it('requires verification and disclosure before acceptance', () => {
    expect(transitionConsent(base, 'accept', at(2)).ok).toBe(false);
    expect(transitionConsent(base, 'verify', at(2)).ok).toBe(false);

    const withVerification: ConsentGrant = { ...base, verificationId: 'verification.1' };
    expect(transitionConsent(withVerification, 'accept', at(2)).ok).toBe(false);
    const verified = transitionConsent(withVerification, 'verify', at(2));
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(transitionConsent(verified.grant, 'accept', at(2)).ok).toBe(false);
  });

  it('follows invitation → verification → disclosure → acceptance', () => {
    const withVerification: ConsentGrant = { ...base, verificationId: 'verification.1' };
    let grant = withVerification;
    for (const [event, status] of [
      ['verify', 'identity-verified'],
      ['disclose', 'scope-disclosed'],
      ['accept', 'active'],
    ] as const) {
      const next = transitionConsent(grant, event, at(3));
      expect(next.ok).toBe(true);
      if (next.ok) {
        grant = next.grant;
        expect(grant.status).toBe(status);
      }
    }
    expect(grant.acceptedAt).toBe(at(3));
    expect(acceptanceRecord(grant).status).toBe('active');
  });

  it('grants no access on decline and allows no transitions afterwards', () => {
    const declined = transitionConsent(base, 'decline', at(2));
    expect(declined.ok).toBe(true);
    if (declined.ok) {
      expect(declined.grant.status).toBe('declined');
      expect(declined.grant.declinedAt).toBe(at(2));
      expect(transitionConsent(declined.grant, 'accept', at(3)).ok).toBe(false);
      expect(isConsentActive(declined.grant, at(3))).toBe(false);
    }
  });

  it('supports expiry and revocation from active only', () => {
    const active: ConsentGrant = {
      ...base,
      status: 'active',
      acceptedAt: at(1),
      verificationId: 'verification.1',
      expiresAt: at(5),
    };
    expect(transitionConsent(active, 'verify', at(2)).ok).toBe(false);
    expect(effectiveConsentStatus(active, at(4))).toBe('active');
    expect(effectiveConsentStatus(active, at(5))).toBe('expired');
    expect(isConsentActive(active, at(6))).toBe(false);

    const revoked = transitionConsent(active, 'revoke', at(3));
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.grant.status).toBe('revoked');
      expect(revoked.grant.revokedAt).toBe(at(3));
      expect(transitionConsent(revoked.grant, 'expire', at(6)).ok).toBe(false);
    }
  });
});
