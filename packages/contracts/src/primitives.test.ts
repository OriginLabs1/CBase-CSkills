import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64.js';
import { contentHash, sha256Fallback, sha256Hex } from './hash.js';

const encoder = new TextEncoder();

describe('SHA-256 primitives', () => {
  it('matches published vectors without WebCrypto', () => {
    expect(sha256Fallback(encoder.encode('abc')))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Fallback(encoder.encode('')))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('agrees with WebCrypto when available', async () => {
    expect(await sha256Hex(encoder.encode('abc'))).toBe(sha256Fallback(encoder.encode('abc')));
  });

  it('returns the prefixed content hash form', async () => {
    expect(await contentHash(encoder.encode('abc')))
      .toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('base64 primitives', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});
