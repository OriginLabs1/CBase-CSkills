import { randomInt, randomBytes } from 'node:crypto';
import { sha256Fallback, sha256Hex } from '@oneorigin/contracts';
import {
  OTP_DIGITS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  isSixDigitCode,
} from '@oneorigin/identity';

const encoder = new TextEncoder();

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email) {
  const value = normalizeEmail(email);
  return value.length >= 5 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hashEmail(email) {
  return `sha256:${await sha256Hex(encoder.encode(normalizeEmail(email)))}`;
}

export function generateCode() {
  return randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');
}

/** Uses the shared synchronous primitive so verification stays straightforward. */
export function hashCode(code, challengeId) {
  return `sha256:${sha256Fallback(encoder.encode(`${code}:${challengeId}`))}`;
}

/** Constant-time comparison of two equal-format hex hashes. */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function freshIdentityMaterial() {
  return randomBytes(32).toString('hex');
}

export function createChallengeState(emailHash, id, code) {
  const createdAt = new Date();
  return {
    id,
    emailHash,
    codeHash: hashCode(code, id),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    status: 'pending',
  };
}

export { OTP_DIGITS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, isSixDigitCode };
