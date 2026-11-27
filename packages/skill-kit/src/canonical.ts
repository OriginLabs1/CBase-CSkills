import { canonicalJson, contentHash } from '@oneorigin/contracts';
import type { SkillDocument } from './types.js';

/** Re-exported for compatibility with v0.0.1 consumers. */
export { sha256Fallback, sha256Hex } from '@oneorigin/contracts';

/** Deterministic identity for a skill version. See docs/specs/02-skill-md-conformance.md. */
export async function skillIdentity(document: SkillDocument): Promise<string> {
  const canonical = {
    name: document.name,
    description: document.description,
    version: document.version ?? '0.0.0',
    tags: [...new Set(document.tags.filter((t) => t.length > 0))].sort(),
    authors: document.authors ? [...document.authors].sort() : undefined,
    license: document.license,
    permissions: document.permissions,
    body: document.body,
  };
  return contentHash(new TextEncoder().encode(canonicalJson(canonical)));
}
