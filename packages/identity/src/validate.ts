import {
  canonicalJson,
  contentHash,
  sha256Hex,
  type Diagnostic,
  type ValidationReport,
} from '@oneorigin/contracts';
import {
  CONSENT_SCHEMA,
  EMAIL_CREDENTIAL_SCHEMA,
  ENVELOPE_SCHEMA,
  IDENTITY_SCHEMA,
  MEMBERSHIP_SCHEMA,
  ORGANIZATION_SCHEMA,
  PROFILE_SCHEMA,
  type ConsentGrant,
  type EmailChallenge,
  type Identity,
  type Session,
  type VerifiableEnvelope,
} from './types.js';

const encoder = new TextEncoder();
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHA_REF = /^sha256:[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const GENERIC_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const IDENTITY_ID = /^urn:oneorigin:identity:[0-9a-f]{64}$/;
const HANDLE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const APP_ID = /^[a-z][a-z0-9._-]{1,63}$/;
const EMAIL_CODE = /^\d{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function report(diagnostics: Diagnostic[]): ValidationReport {
  return { ok: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

type Push = (code: string, path: string, message: string, severity?: Diagnostic['severity']) => void;

function time(value: unknown, path: string, push: Push, required = true): void {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || !RFC3339.test(value) || Number.isNaN(Date.parse(value))) {
    push('IDT002', path, 'Timestamp must be RFC 3339 with an explicit offset.');
  }
}

function hashRef(value: unknown, path: string, push: Push): void {
  if (typeof value !== 'string' || !SHA_REF.test(value)) {
    push('IDT003', path, 'Value must be sha256:<64 lowercase hex chars>.');
  }
}

function stringField(
  value: unknown,
  path: string,
  push: Push,
  options: { min?: number; max?: number; pattern?: RegExp; required?: boolean } = {},
): void {
  const { min = 1, max = 4096, pattern, required = true } = options;
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || value.length < min || value.length > max || (pattern && !pattern.test(value))) {
    push('IDT004', path, `Invalid string field (expected ${min}–${max} characters${pattern ? ' matching the required pattern' : ''}).`);
  }
}

/** Validates a provider-independent identity. */
export function validateIdentity(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('ID001', '/', 'Identity must be a JSON object.');
    return report(d);
  }
  if (value.schema !== IDENTITY_SCHEMA) push('ID002', '/schema', `schema must be "${IDENTITY_SCHEMA}".`);
  stringField(value.id, '/id', push, { pattern: IDENTITY_ID, min: 87, max: 87 });
  time(value.createdAt, '/createdAt', push);
  if (value.keyId !== undefined) stringField(value.keyId, '/keyId', push, { max: 256 });
  if (value.issuer !== undefined) stringField(value.issuer, '/issuer', push, { max: 256 });
  for (const key of Object.keys(value)) {
    if (!['schema', 'id', 'createdAt', 'keyId', 'issuer', 'extensions'].includes(key)) {
      push('ID003', `/${key}`, 'Unknown field; preserve it in extensions.', 'info');
    }
  }
  return report(d);
}

/** Validates a hashed email proof. Plaintext email addresses are not part of the contract. */
export function validateEmailCredential(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('EC001', '/', 'Email credential must be a JSON object.');
    return report(d);
  }
  if (value.schema !== EMAIL_CREDENTIAL_SCHEMA) push('EC002', '/schema', `schema must be "${EMAIL_CREDENTIAL_SCHEMA}".`);
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  stringField(value.identityId, '/identityId', push, { pattern: IDENTITY_ID });
  hashRef(value.emailHash, '/emailHash', push);
  time(value.verifiedAt, '/verifiedAt', push);
  stringField(value.issuer, '/issuer', push, { max: 256 });
  if (value.method !== 'email-otp') push('EC003', '/method', 'method must be "email-otp".');
  if (value.revokedAt !== undefined) time(value.revokedAt, '/revokedAt', push);
  return report(d);
}

/** Validates challenge metadata. Code values must never be stored in this record. */
export function validateEmailChallenge(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('CH001', '/', 'Email challenge must be a JSON object.');
    return report(d);
  }
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  hashRef(value.emailHash, '/emailHash', push);
  hashRef(value.codeHash, '/codeHash', push);
  time(value.createdAt, '/createdAt', push);
  time(value.expiresAt, '/expiresAt', push);
  if (!Number.isInteger(value.attempts) || (value.attempts as number) < 0) push('CH002', '/attempts', 'attempts must be a non-negative integer.');
  if (value.maxAttempts !== 5) push('CH003', '/maxAttempts', 'v0.0.2 requires at most five incorrect attempts.');
  if (!['pending', 'verified', 'expired', 'exhausted', 'revoked'].includes(value.status as string)) {
    push('CH004', '/status', 'Unknown challenge status.');
  }
  if (typeof value.code === 'string' || typeof value.email === 'string') {
    push('CH005', '/', 'Plaintext code and email must not appear in a challenge record.', 'warning');
  }
  const challenge = value as unknown as EmailChallenge;
  if (typeof value.expiresAt === 'string' && typeof value.createdAt === 'string'
    && Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) {
    push('CH006', '/expiresAt', 'Challenge must expire after it was created.');
  } else if (typeof value.expiresAt === 'string' && challenge.status === 'pending' && Date.parse(value.expiresAt) <= Date.now()) {
    push('CH007', '/expiresAt', 'Challenge has expired; service must mark it expired.', 'info');
  }
  return report(d);
}

/** Six-digit code shape. Delivered codes are compared in constant time by the service. */
export function isSixDigitCode(value: string): boolean {
  return EMAIL_CODE.test(value);
}

export function validateSession(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('SE001', '/', 'Session must be a JSON object.');
    return report(d);
  }
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  stringField(value.identityId, '/identityId', push, { pattern: IDENTITY_ID });
  time(value.issuedAt, '/issuedAt', push);
  time(value.expiresAt, '/expiresAt', push);
  if (value.revokedAt !== undefined) time(value.revokedAt, '/revokedAt', push);
  return report(d);
}

export function validateProgrammerProfile(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('PR001', '/', 'Profile must be a JSON object.');
    return report(d);
  }
  if (value.schema !== PROFILE_SCHEMA) push('PR002', '/schema', `schema must be "${PROFILE_SCHEMA}".`);
  stringField(value.identityId, '/identityId', push, { pattern: IDENTITY_ID });
  stringField(value.handle, '/handle', push, { pattern: HANDLE });
  stringField(value.displayName, '/displayName', push, { max: 120 });
  if (!['public', 'members', 'self'].includes(value.visibility as string)) {
    push('PR003', '/visibility', 'visibility must be public, members or self.');
  }
  if (value.bio !== undefined) stringField(value.bio, '/bio', push, { max: 4096 });
  if (value.links !== undefined) {
    if (!Array.isArray(value.links) || value.links.length > 16 || value.links.some((link) => typeof link !== 'string' || link.length > 512)) {
      push('PR004', '/links', 'links must be at most 16 strings of at most 512 characters.');
    }
  }
  time(value.updatedAt, '/updatedAt', push);
  for (const key of ['email', 'emailHash', 'credential', 'password', 'secret']) {
    if (key in value) push('PR005', `/${key}`, 'Private credential fields must not be placed in a profile.', 'warning');
  }
  return report(d);
}

export function validateOrganization(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('OR001', '/', 'Organization must be a JSON object.');
    return report(d);
  }
  if (value.schema !== ORGANIZATION_SCHEMA) push('OR002', '/schema', `schema must be "${ORGANIZATION_SCHEMA}".`);
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  stringField(value.name, '/name', push, { max: 120 });
  stringField(value.ownerIdentityId, '/ownerIdentityId', push, { pattern: IDENTITY_ID });
  time(value.createdAt, '/createdAt', push);
  return report(d);
}

export function validateMembership(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('MB001', '/', 'Membership must be a JSON object.');
    return report(d);
  }
  if (value.schema !== MEMBERSHIP_SCHEMA) push('MB002', '/schema', `schema must be "${MEMBERSHIP_SCHEMA}".`);
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  stringField(value.identityId, '/identityId', push, { pattern: IDENTITY_ID });
  stringField(value.organizationId, '/organizationId', push, { pattern: GENERIC_ID });
  if (!Array.isArray(value.roles) || value.roles.length === 0
    || value.roles.some((role) => typeof role !== 'string' || !GENERIC_ID.test(role))) {
    push('MB003', '/roles', 'roles must be a non-empty array of identifiers.');
  }
  if (!['invited', 'active', 'suspended', 'revoked'].includes(value.status as string)) {
    push('MB004', '/status', 'Unknown membership status.');
  }
  time(value.issuedAt, '/issuedAt', push);
  if (value.expiresAt !== undefined) time(value.expiresAt, '/expiresAt', push);
  if (value.revokedAt !== undefined) time(value.revokedAt, '/revokedAt', push);
  return report(d);
}

const KINDS = ['observability', 'administration', 'membership'];
const STATUSES = ['invited', 'identity-verified', 'scope-disclosed', 'active', 'declined', 'expired', 'revoked'];
const CATEGORIES = [
  'application-health', 'execution-lifecycle', 'authorization-outcome', 'audit-integrity',
  'operational-failure', 'workspace-diagnostics', 'capability-health', 'skill-lifecycle',
  'execution-provenance', 'compatibility', 'user-content',
];
const OPERATIONS = ['read', 'diagnose', 'administrate'];

/** Validates consent records without consulting a clock or external state. */
export function validateConsentGrant(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('CG001', '/', 'Consent grant must be a JSON object.');
    return report(d);
  }
  if (value.schema !== CONSENT_SCHEMA) push('CG002', '/schema', `schema must be "${CONSENT_SCHEMA}".`);
  stringField(value.id, '/id', push, { pattern: GENERIC_ID });
  if (!KINDS.includes(value.kind as string)) push('CG003', '/kind', 'Unknown consent kind.');
  for (const field of ['subjectIdentityId', 'granteeIdentityId', 'inviterIdentityId'] as const) {
    stringField(value[field], `/${field}`, push, { pattern: IDENTITY_ID });
  }
  stringField(value.application, '/application', push, { pattern: APP_ID });
  stringField(value.purpose, '/purpose', push, { max: 1000 });
  const categories = value.dataCategories;
  if (!Array.isArray(categories) || categories.length === 0
    || categories.some((category) => typeof category !== 'string' || !CATEGORIES.includes(category))) {
    push('CG004', '/dataCategories', 'dataCategories must be a non-empty array of known categories.');
  }
  const operations = value.operations;
  if (!Array.isArray(operations) || operations.length === 0
    || operations.some((operation) => typeof operation !== 'string' || !OPERATIONS.includes(operation))) {
    push('CG005', '/operations', 'operations must be a non-empty array of known operations.');
  }
  stringField(value.scopeDisclosure, '/scopeDisclosure', push, { max: 8000 });
  if (!STATUSES.includes(value.status as string)) push('CG006', '/status', 'Unknown consent status.');
  time(value.createdAt, '/createdAt', push);
  if (value.expiresAt !== undefined) time(value.expiresAt, '/expiresAt', push);
  if (value.acceptedAt !== undefined) time(value.acceptedAt, '/acceptedAt', push);
  if (value.declinedAt !== undefined) time(value.declinedAt, '/declinedAt', push);
  if (value.revokedAt !== undefined) time(value.revokedAt, '/revokedAt', push);
  if (value.verificationId !== undefined) stringField(value.verificationId, '/verificationId', push, { pattern: GENERIC_ID });
  if (value.userContentAuthorizationId !== undefined) {
    stringField(value.userContentAuthorizationId, '/userContentAuthorizationId', push, { pattern: GENERIC_ID });
  }

  if (Array.isArray(operations) && operations.includes('administrate') && value.kind !== 'administration') {
    push('CG009', '/operations', 'The administrate operation requires kind "administration".');
  }
  if (Array.isArray(categories) && categories.includes('user-content') && !value.userContentAuthorizationId) {
    push('CG010', '/dataCategories', 'user-content requires a separate explicit userContentAuthorizationId.');
  }
  if (value.status === 'declined' && value.declinedAt === undefined) push('CG011', '/declinedAt', 'A declined grant must record when it was declined.');
  if (value.status === 'active' && value.acceptedAt === undefined) push('CG012', '/acceptedAt', 'An active grant must record acceptance.');
  if (value.status === 'revoked' && value.revokedAt === undefined) push('CG013', '/revokedAt', 'A revoked grant must record when it was revoked.');
  if (value.status === 'expired' && value.expiresAt === undefined) push('CG014', '/expiresAt', 'An expired grant must have an expiry.');
  if (value.kind === 'observability' && value.subjectIdentityId === value.granteeIdentityId) {
    push('CG015', '/granteeIdentityId', 'Self-observability grants are unnecessary.', 'warning');
  }
  if (value.status !== 'invited' && value.status !== 'declined' && !value.verificationId) {
    push('CG016', '/verificationId', 'Post-invitation grants should reference a verified identity.', 'warning');
  }
  return report(d);
}

/** Canonical bytes covered by `contentHash`. Hash, proof and chain are excluded. */
export function envelopeCanonicalString<T>(envelope: VerifiableEnvelope<T>): string {
  return canonicalJson({
    schema: envelope.schema,
    kind: envelope.kind,
    subject: envelope.subject,
    issuer: envelope.issuer,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    payload: envelope.payload,
  });
}

export function validateVerifiableEnvelope(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('VE001', '/', 'Verifiable envelope must be a JSON object.');
    return report(d);
  }
  if (value.schema !== ENVELOPE_SCHEMA) push('VE002', '/schema', `schema must be "${ENVELOPE_SCHEMA}".`);
  if (!['identity', 'email-credential', 'profile', 'membership', 'consent', 'authorization'].includes(value.kind as string)) {
    push('VE003', '/kind', 'Unknown record kind.');
  }
  stringField(value.subject, '/subject', push, { max: 256 });
  stringField(value.issuer, '/issuer', push, { max: 256 });
  time(value.issuedAt, '/issuedAt', push);
  if (value.expiresAt !== undefined) time(value.expiresAt, '/expiresAt', push);
  if (!isRecord(value.payload)) push('VE004', '/payload', 'payload must be a JSON object.');
  hashRef(value.contentHash, '/contentHash', push);
  if (value.proof !== undefined) {
    if (!isRecord(value.proof)) {
      push('VE005', '/proof', 'proof must be an object.');
    } else {
      if (!['ed25519', 'sha256'].includes(value.proof.algorithm as string)) push('VE006', '/proof/algorithm', 'Unknown proof algorithm.');
      stringField(value.proof.value, '/proof/value', push, { max: 512 });
      stringField(value.proof.signer, '/proof/signer', push, { max: 256 });
      time(value.proof.signedAt, '/proof/signedAt', push);
    }
  }
  if (value.chain !== undefined) {
    if (!isRecord(value.chain)) {
      push('VE007', '/chain', 'chain must be an object.');
    } else {
      for (const field of ['previousHash', 'recordHash'] as const) {
        const chainValue = value.chain[field];
        if (typeof chainValue !== 'string' || !(SHA_REF.test(chainValue) || HEX64.test(chainValue))) {
          push('VE008', `/chain/${field}`, 'Chain hashes must be 64 hex characters, optionally sha256-prefixed.');
        }
      }
    }
  }
  return report(d);
}

/**
 * Verifies content addressing and hash proofs. Ed25519 signatures require an
 * external trusted key and are reported as info, never treated as proof here.
 */
export async function verifyEnvelopeIntegrity<T>(envelope: VerifiableEnvelope<T>): Promise<ValidationReport> {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  const shape = validateVerifiableEnvelope(envelope);
  d.push(...shape.diagnostics);
  if (!shape.ok) return report(d);

  const expected = await contentHash(encoder.encode(envelopeCanonicalString(envelope)));
  if (expected !== envelope.contentHash) push('VE010', '/contentHash', 'Content hash does not match the canonical envelope.');
  const proof = envelope.proof;
  if (proof?.algorithm === 'sha256' && proof.value !== envelope.contentHash) {
    push('VE011', '/proof/value', 'SHA-256 proof does not match the content hash.');
  }
  if (proof?.algorithm === 'ed25519') {
    push('VE012', '/proof', 'Ed25519 signatures require verification against a trusted public key.', 'info');
  }
  return report(d);
}

/** Creates a content hash for a record payload without embedding secrets. */
export async function hashIdentityId(value: string): Promise<string> {
  return `urn:oneorigin:identity:${await sha256Hex(encoder.encode(value.trim().toLowerCase()))}`;
}

export { type ConsentGrant, type EmailChallenge, type Identity, type Session, type VerifiableEnvelope };
