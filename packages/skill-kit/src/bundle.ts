import {
  BUNDLE_SCHEMA,
  base64ToBytes,
  bytesToBase64,
  canonicalJson,
  sha256Hex,
  validateCapabilityManifest,
  type Bundle,
  type BundleItem,
  type Diagnostic,
  type ValidationReport,
} from '@oneorigin/contracts';

const encoder = new TextEncoder();

/** Re-exported for compatibility with v0.0.1 consumers. */
export { base64ToBytes, bytesToBase64 };

export async function itemFromBytes(path: string, mediaType: string, bytes: Uint8Array): Promise<BundleItem> {
  return { path, mediaType, bytes: bytesToBase64(bytes), sha256: await sha256Hex(bytes) };
}

/** Build a signed (integrity-only) portable bundle. */
export async function createBundle(input: {
  kind: Bundle['kind'];
  items: BundleItem[];
  manifests: Bundle['manifests'];
  createdAt?: string;
}): Promise<Bundle> {
  const unsigned: Bundle = {
    schema: BUNDLE_SCHEMA,
    kind: input.kind,
    createdAt: input.createdAt ?? new Date().toISOString(),
    items: input.items,
    manifests: input.manifests,
  };
  const value = await sha256Hex(encoder.encode(canonicalJson(unsigned)));
  return { ...unsigned, signature: { algorithm: 'sha256', value } };
}

/** Validate paths, item hashes and the bundle signature before import. */
export async function verifyBundle(bundle: unknown): Promise<ValidationReport> {
  const d: Diagnostic[] = [];
  const push = (code: string, path: string, message: string) =>
    d.push({ code, severity: 'error' as const, path, message });

  if (!bundle || typeof bundle !== 'object') {
    push('BUNDLE001', '/', 'Bundle must be an object.');
    return { ok: false, diagnostics: d };
  }
  const b = bundle as Partial<Bundle>;
  if (b.schema !== BUNDLE_SCHEMA) push('BUNDLE002', '/schema', 'Unsupported bundle schema.');
  if (b.kind !== 'skill-pack' && b.kind !== 'workspace') push('BUNDLE003', '/kind', 'Unknown bundle kind.');
  if (!Array.isArray(b.items)) push('BUNDLE004', '/items', 'items must be an array.');
  if (!Array.isArray(b.manifests)) push('BUNDLE005', '/manifests', 'manifests must be an array.');

  for (const [index, item] of (b.items ?? []).entries()) {
    if (!item || typeof item.path !== 'string' || item.path.length === 0) {
      push('BUNDLE006', `/items/${index}/path`, 'Item needs a path.');
      continue;
    }
    if (
      item.path.startsWith('/') ||
      item.path.split(/[\\/]/).includes('..') ||
      item.path.includes('\0') ||
      /^[A-Za-z]:/.test(item.path)
    ) {
      push('BUNDLE007', `/items/${index}/path`, 'Unsafe path in bundle.');
    }
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(item.bytes);
    } catch {
      push('BUNDLE008', `/items/${index}/bytes`, 'Item bytes are not valid base64.');
      continue;
    }
    if (await sha256Hex(bytes) !== item.sha256) {
      push('BUNDLE009', `/items/${index}/sha256`, 'Item hash does not match its bytes.');
    }
  }

  for (const [index, manifest] of (b.manifests ?? []).entries()) {
    const report = validateCapabilityManifest(manifest);
    for (const diagnostic of report.diagnostics) {
      if (diagnostic.severity === 'error') {
        push('BUNDLE010', `/manifests/${index}${diagnostic.path}`, diagnostic.message);
      }
    }
  }

  if (b.signature) {
    const unsigned = { ...b } as Record<string, unknown>;
    delete unsigned.signature;
    const expected = await sha256Hex(encoder.encode(canonicalJson(unsigned)));
    if (b.signature.value !== expected) push('BUNDLE011', '/signature', 'Bundle signature does not match contents.');
  }

  return { ok: d.length === 0, diagnostics: d };
}
