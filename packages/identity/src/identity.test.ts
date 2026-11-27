import { describe, expect, it } from 'vitest';
import { envelopeCanonicalString, validateIdentity } from './validate.js';
import {
  hashIdentityId,
  isSixDigitCode,
  validateConsentGrant,
  validateEmailChallenge,
  validateEmailCredential,
  validateProgrammerProfile,
  validateVerifiableEnvelope,
  verifyEnvelopeIntegrity,
} from './index.js';
import type { ConsentGrant, ProgrammerProfile, VerifiableEnvelope } from './types.js';
import { containsPrivateField, profileForViewer } from './privacy.js';

const identityId = `urn:oneorigin:identity:${'a'.repeat(64)}`;
const otherId = `urn:oneorigin:identity:${'b'.repeat(64)}`;
const sha = `sha256:${'c'.repeat(64)}`;

const identity = {
  schema: 'oneorigin.identity/v0.0.2',
  id: identityId,
  createdAt: '2026-01-01T00:00:00Z',
};

const grant: ConsentGrant = {
  schema: 'oneorigin.consent/v0.0.2',
  id: 'consent.observability.1',
  kind: 'observability',
  subjectIdentityId: identityId,
  granteeIdentityId: otherId,
  inviterIdentityId: identityId,
  application: 'corecenter',
  purpose: 'Monitor CoreBase execution health.',
  dataCategories: ['application-health', 'audit-integrity'],
  operations: ['read'],
  scopeDisclosure: 'Operational metadata only; no user content.',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  acceptedAt: '2026-01-02T00:00:00Z',
  verificationId: 'verification.programmer.1',
};

const profile: ProgrammerProfile = {
  schema: 'oneorigin.profile/v0.0.2',
  identityId,
  handle: 'ada-dev',
  displayName: 'Ada',
  visibility: 'members',
  bio: 'Builds portable tools.',
  links: ['https://example.org/ada'],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('identity contracts', () => {
  it('accepts a provider-independent identity', () => {
    expect(validateIdentity(identity).ok).toBe(true);
  });

  it('derives stable identity ids from a normalized value', async () => {
    const first = await hashIdentityId('  Ada@Example.COM ');
    const second = await hashIdentityId('ada@example.com');
    expect(first).toBe(second);
    expect(validateIdentity({ ...identity, id: first }).ok).toBe(true);
  });

  it('rejects email-based identity ids', () => {
    expect(validateIdentity({ ...identity, id: 'ada@example.com' }).ok).toBe(false);
  });
});

describe('email OTP contracts', () => {
  it('rejects plaintext values in challenge records', () => {
    const result = validateEmailChallenge({
      id: 'challenge.1',
      emailHash: sha,
      codeHash: sha,
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-01T00:05:00Z',
      attempts: 0,
      maxAttempts: 5,
      status: 'pending',
      email: 'ada@example.com',
      code: '123456',
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain('CH005');
  });

  it('enforces six-digit codes and five attempts', () => {
    expect(isSixDigitCode('123456')).toBe(true);
    expect(isSixDigitCode('12345')).toBe(false);
    expect(isSixDigitCode('1234567')).toBe(false);
    const result = validateEmailChallenge({
      id: 'challenge.1', emailHash: sha, codeHash: sha,
      createdAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-01T00:05:00Z',
      attempts: 0, maxAttempts: 10, status: 'pending',
    });
    expect(result.diagnostics.map((d) => d.code)).toContain('CH003');
  });

  it('keeps plaintext email out of credentials', () => {
    expect(validateEmailCredential({
      schema: 'oneorigin.email-credential/v0.0.2',
      id: 'credential.1',
      identityId,
      emailHash: sha,
      verifiedAt: '2026-01-01T00:00:00Z',
      issuer: 'urn:oneorigin:issuer:oneorigin',
      method: 'email-otp',
    }).ok).toBe(true);
  });
});

describe('consent contracts', () => {
  it('rejects user-content without a separate authorization', () => {
    const result = validateConsentGrant({
      ...grant,
      dataCategories: ['user-content'],
    });
    expect(result.diagnostics.map((d) => d.code)).toContain('CG010');
  });

  it('rejects administration operations on an observability grant', () => {
    const result = validateConsentGrant({ ...grant, operations: ['administrate'] });
    expect(result.diagnostics.map((d) => d.code)).toContain('CG009');
  });

  it('requires acceptance and verification timestamps', () => {
    const result = validateConsentGrant({
      ...grant,
      acceptedAt: undefined,
      verificationId: undefined,
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(['CG012', 'CG016']));
  });
});

describe('profile privacy', () => {
  it('hides private details for self visibility', () => {
    const view = profileForViewer({ ...profile, visibility: 'self' }, 'public');
    expect(view).toEqual({ identityId, handle: 'ada-dev' });
    expect(containsPrivateField(view)).toBe(false);
  });

  it('never exposes credential fields', () => {
    const result = validateProgrammerProfile({ ...profile, emailHash: sha });
    expect(result.diagnostics.map((d) => d.code)).toContain('PR005');
    expect(containsPrivateField(profileForViewer(profile, 'member'))).toBe(false);
  });
});

describe('verifiable envelopes', () => {
  const envelope: VerifiableEnvelope<typeof identity> = {
    schema: 'oneorigin.verification/v0.0.2',
    kind: 'identity',
    subject: identityId,
    issuer: 'urn:oneorigin:issuer:oneorigin',
    issuedAt: '2026-01-01T00:00:00Z',
    payload: identity,
    contentHash: `sha256:${'0'.repeat(64)}`,
  };

  it('detects a tampered content hash', async () => {
    const result = await verifyEnvelopeIntegrity(envelope);
    expect(result.diagnostics.map((d) => d.code)).toContain('VE010');
  });

  it('accepts a correctly hashed envelope with a hash proof', async () => {
    const { contentHash } = await import('@oneorigin/contracts');
    const hash = await contentHash(new TextEncoder().encode(envelopeCanonicalString(envelope)));
    const signed: VerifiableEnvelope<typeof identity> = {
      ...envelope,
      contentHash: hash,
      proof: { algorithm: 'sha256', value: hash, signer: envelope.issuer, signedAt: envelope.issuedAt },
    };
    expect(validateVerifiableEnvelope(signed).ok).toBe(true);
    expect((await verifyEnvelopeIntegrity(signed)).ok).toBe(true);
  });
});
