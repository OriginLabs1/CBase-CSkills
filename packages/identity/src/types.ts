/** Shared identity, membership and consent contracts. See docs/specs/07–09. */

export const IDENTITY_SCHEMA = 'oneorigin.identity/v0.0.2' as const;
export const EMAIL_CREDENTIAL_SCHEMA = 'oneorigin.email-credential/v0.0.2' as const;
export const PROFILE_SCHEMA = 'oneorigin.profile/v0.0.2' as const;
export const ORGANIZATION_SCHEMA = 'oneorigin.organization/v0.0.2' as const;
export const MEMBERSHIP_SCHEMA = 'oneorigin.membership/v0.0.2' as const;
export const CONSENT_SCHEMA = 'oneorigin.consent/v0.0.2' as const;
export const ENVELOPE_SCHEMA = 'oneorigin.verification/v0.0.2' as const;

/** Email OTP parameters fixed by the v0.0.2 blueprint. */
export const OTP_DIGITS = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * A provider-independent identity. Email addresses are verified credentials
 * attached to this identity, never its primary key.
 */
export interface Identity {
  schema: typeof IDENTITY_SCHEMA;
  /** `urn:oneorigin:identity:<64 hex chars>` */
  id: string;
  createdAt: string;
  /** Reference to a public key or key handle. Never contains secret material. */
  keyId?: string;
  /** Optional registration issuer; it does not own or replace `id`. */
  issuer?: string;
  extensions?: Record<string, unknown>;
}

/** Proof that a normalized email address was controlled at `verifiedAt`. */
export interface EmailCredential {
  schema: typeof EMAIL_CREDENTIAL_SCHEMA;
  id: string;
  identityId: string;
  /** `sha256:<hex>` of the lowercased, trimmed email address. */
  emailHash: string;
  verifiedAt: string;
  issuer: string;
  method: 'email-otp';
  revokedAt?: string;
}

/** Short-lived, single-use challenge state. Code values are never in contracts. */
export interface EmailChallenge {
  id: string;
  emailHash: string;
  /** `sha256:<hex>` of the six-digit code plus challenge id. */
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'verified' | 'expired' | 'exhausted' | 'revoked';
}

export interface Session {
  id: string;
  identityId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export type ProfileVisibility = 'public' | 'members' | 'self';

/**
 * Public-facing programmer information. Email addresses and other private
 * fields are deliberately absent; they live in credentials and consent scopes.
 */
export interface ProgrammerProfile {
  schema: typeof PROFILE_SCHEMA;
  identityId: string;
  handle: string;
  displayName: string;
  visibility: ProfileVisibility;
  bio?: string;
  links?: string[];
  updatedAt: string;
}

export interface Organization {
  schema: typeof ORGANIZATION_SCHEMA;
  id: string;
  name: string;
  ownerIdentityId: string;
  createdAt: string;
}

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';

export interface Membership {
  schema: typeof MEMBERSHIP_SCHEMA;
  id: string;
  identityId: string;
  organizationId: string;
  roles: string[];
  status: MembershipStatus;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export type ConsentKind = 'observability' | 'administration' | 'membership';
export type ConsentStatus =
  | 'invited'
  | 'identity-verified'
  | 'scope-disclosed'
  | 'active'
  | 'declined'
  | 'expired'
  | 'revoked';
export type ConsentEvent = 'verify' | 'disclose' | 'accept' | 'decline' | 'expire' | 'revoke';

export type DataCategory =
  | 'application-health'
  | 'execution-lifecycle'
  | 'authorization-outcome'
  | 'audit-integrity'
  | 'operational-failure'
  | 'workspace-diagnostics'
  | 'capability-health'
  | 'skill-lifecycle'
  | 'execution-provenance'
  | 'compatibility'
  | 'user-content';

export type ConsentOperation = 'read' | 'diagnose' | 'administrate';

/**
 * An auditable authorization record for a person/application to observe or
 * administer another person's operational data. Distinct from capability grants.
 */
export interface ConsentGrant {
  schema: typeof CONSENT_SCHEMA;
  id: string;
  kind: ConsentKind;
  /** The data owner whose operational data may be observed. */
  subjectIdentityId: string;
  /** Verified identity of the programmer or service operator receiving access. */
  granteeIdentityId: string;
  inviterIdentityId: string;
  /** `corebase` | `coreskills` | `corecenter` or an agreed application id. */
  application: string;
  purpose: string;
  dataCategories: DataCategory[];
  operations: ConsentOperation[];
  /** Human-readable disclosure shown before acceptance. */
  scopeDisclosure: string;
  status: ConsentStatus;
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  revokedAt?: string;
  /** Reference to a verified identity record for the grantee. */
  verificationId?: string;
  /** Separate explicit authorization required for the `user-content` category. */
  userContentAuthorizationId?: string;
}

export type EnvelopeKind =
  | 'identity'
  | 'email-credential'
  | 'profile'
  | 'membership'
  | 'consent'
  | 'authorization';

export interface RecordProof {
  algorithm: 'ed25519' | 'sha256';
  value: string;
  signer: string;
  signedAt: string;
}

export interface ChainLink {
  /** 64 zero characters for genesis, otherwise the previous record hash. */
  previousHash: string;
  recordHash: string;
}

/** Canonical, content-addressed wrapper for independently verifiable records. */
export interface VerifiableEnvelope<T = unknown> {
  schema: typeof ENVELOPE_SCHEMA;
  kind: EnvelopeKind;
  subject: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  payload: T;
  /** `sha256:<hex>` over the canonical envelope without hash, proof and chain. */
  contentHash: string;
  proof?: RecordProof;
  chain?: ChainLink;
}
