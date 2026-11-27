import { contentHash } from '@oneorigin/contracts';
import { ENVELOPE_SCHEMA, type EnvelopeKind, type VerifiableEnvelope } from './types.js';
import { envelopeCanonicalString } from './validate.js';

/** Creates a content-addressed envelope. A `sha256` proof is self-integrity only. */
export async function createVerifiableEnvelope<T>(input: {
  kind: EnvelopeKind;
  subject: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  payload: T;
  proofSigner?: string;
}): Promise<VerifiableEnvelope<T>> {
  const base = {
    schema: ENVELOPE_SCHEMA,
    kind: input.kind,
    subject: input.subject,
    issuer: input.issuer,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    payload: input.payload,
  } as VerifiableEnvelope<T>;
  const hash = await contentHash(new TextEncoder().encode(envelopeCanonicalString(base)));
  const proof = input.proofSigner
    ? { algorithm: 'sha256' as const, value: hash, signer: input.proofSigner, signedAt: input.issuedAt }
    : undefined;
  return { ...base, contentHash: hash, ...(proof ? { proof } : {}) };
}

/** Extends an audit trail without rewriting an earlier envelope. */
export function chainEnvelope<T>(
  envelope: VerifiableEnvelope<T>,
  previous: VerifiableEnvelope<unknown> | undefined,
): VerifiableEnvelope<T> {
  return {
    ...envelope,
    chain: {
      previousHash: previous?.contentHash ?? '0'.repeat(64),
      recordHash: envelope.contentHash,
    },
  };
}
