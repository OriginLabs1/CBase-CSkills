let counter = 0;

function randomPart(): string {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0].toString(16).padStart(8, '0');
  }
  return Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
}

/** RFC 4122-shaped identifier where available, portable fallback otherwise. */
export function randomId(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(16)}-${randomPart()}${randomPart()}-${counter.toString(16).padStart(8, '0')}`;
}
