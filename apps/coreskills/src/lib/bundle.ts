import {
  validateCapabilityManifest,
  type Bundle,
  type BundleItem,
  type CapabilityManifest,
  type Diagnostic
} from '@oneorigin/contracts';
import {
  base64ToBytes,
  createBundle,
  itemFromBytes,
  skillIdentity,
  validateSkillMarkdown,
  verifyBundle
} from '@oneorigin/skill-kit';
import { hashHex, safePathSegment, versionKey } from './helpers.js';
import type { BundleSkillIndex, SkillRecord, SkillVersionRecord } from './types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface BundlePlan {
  skills: SkillRecord[];
  versions: SkillVersionRecord[];
}

export interface BundleImportResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  plan?: BundlePlan;
}

function error(code: string, path: string, message: string): Diagnostic {
  return { code, severity: 'error', path, message };
}

function note(code: string, path: string, message: string): Diagnostic {
  return { code, severity: 'info', path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBundleSkillIndex(value: unknown): value is BundleSkillIndex {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.currentIdentity === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.origin === 'local' || value.origin === 'imported') &&
    Array.isArray(value.versions) &&
    value.versions.every((entry) =>
      isRecord(entry) &&
      typeof entry.identity === 'string' &&
      typeof entry.createdAt === 'string' &&
      typeof entry.label === 'string'
    )
  );
}

/** Export current skills and their complete immutable version history. */
export async function createSkillBundle(
  skills: SkillRecord[],
  versions: SkillVersionRecord[],
  createdAt?: string
): Promise<Bundle> {
  const items: BundleItem[] = [];
  const manifests: CapabilityManifest[] = [];

  for (const skill of skills) {
    const id = safePathSegment(skill.id);
    if (!id) throw new Error(`Skill id "${skill.id}" is not safe for a portable bundle.`);

    items.push(await itemFromBytes(`skills/${id}/SKILL.md`, 'text/markdown', encoder.encode(skill.raw)));

    const ownedVersions = versions.filter((version) => version.skillId === skill.id);
    const index: BundleSkillIndex = {
      id: skill.id,
      name: skill.name,
      currentIdentity: skill.identity,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
      origin: skill.origin,
      versions: ownedVersions.map((version) => ({
        identity: version.identity,
        createdAt: version.createdAt,
        label: version.label
      }))
    };
    items.push(
      await itemFromBytes(`skills/${id}/index.json`, 'application/json', encoder.encode(JSON.stringify(index, null, 2)))
    );

    const seen = new Set<string>();
    for (const version of ownedVersions) {
      if (seen.has(version.identity)) continue;
      seen.add(version.identity);
      items.push(
        await itemFromBytes(
          `skills/${id}/versions/${hashHex(version.identity)}.md`,
          'text/markdown',
          encoder.encode(version.raw)
        )
      );
    }
    manifests.push(skill.manifest);
  }

  return createBundle({ kind: 'skill-pack', items, manifests, createdAt });
}

/**
 * Verify every item, manifest, path and identity before returning a write plan.
 * No storage is touched here; the caller commits `plan` in a single transaction.
 */
export async function planBundleImport(value: unknown): Promise<BundleImportResult> {
  const verification = await verifyBundle(value);
  const diagnostics: Diagnostic[] = [...verification.diagnostics];
  if (!verification.ok) return { ok: false, diagnostics };

  const bundle = value as Bundle;
  if (bundle.kind !== 'skill-pack') {
    diagnostics.push(error('BUNDLE012', '/kind', 'CoreSkills imports skill-pack bundles; this bundle is a workspace.'));
    return { ok: false, diagnostics };
  }

  const items = new Map<string, BundleItem>();
  for (const item of bundle.items) {
    if (items.has(item.path)) {
      diagnostics.push(error('BUNDLE013', `/items/${item.path}`, 'Duplicate item path in bundle.'));
    }
    items.set(item.path, item);
  }

  const plan: BundlePlan = { skills: [], versions: [] };
  const indexPaths = bundle.items.filter((item) => /^skills\/[^/]+\/index\.json$/.test(item.path));
  if (indexPaths.length === 0) {
    diagnostics.push(error('BUNDLE014', '/items', 'Bundle contains no skill indexes.'));
    return { ok: false, diagnostics };
  }

  for (const indexItem of indexPaths) {
    const idFromPath = indexItem.path.slice('skills/'.length, -'/index.json'.length);
    if (!safePathSegment(idFromPath)) {
      diagnostics.push(error('BUNDLE015', indexItem.path, 'Unsafe skill id in bundle path.'));
      continue;
    }

    let parsedIndex: unknown;
    try {
      parsedIndex = JSON.parse(decoder.decode(base64ToBytes(indexItem.bytes)));
    } catch {
      diagnostics.push(error('BUNDLE016', indexItem.path, 'Skill index is not valid JSON.'));
      continue;
    }
    if (!isBundleSkillIndex(parsedIndex)) {
      diagnostics.push(error('BUNDLE017', indexItem.path, 'Skill index has an invalid shape.'));
      continue;
    }
    const index = parsedIndex;
    if (index.id !== idFromPath) {
      diagnostics.push(error('BUNDLE018', indexItem.path, 'Skill index id does not match its path.'));
      continue;
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(index.currentIdentity)) {
      diagnostics.push(error('BUNDLE019', `${indexItem.path}/currentIdentity`, 'Invalid skill identity.'));
      continue;
    }

    const currentPath = `skills/${idFromPath}/SKILL.md`;
    const currentItem = items.get(currentPath);
    if (!currentItem) {
      diagnostics.push(error('BUNDLE020', currentPath, 'Current SKILL.md is missing from the bundle.'));
      continue;
    }

    const validation = validateSkillMarkdown(decoder.decode(base64ToBytes(currentItem.bytes)));
    for (const diagnostic of validation.diagnostics) diagnostics.push({ ...diagnostic, path: `${currentPath}${diagnostic.path}` });
    if (!validation.ok || !validation.document) continue;

    const identity = await skillIdentity(validation.document);
    if (identity !== index.currentIdentity) {
      diagnostics.push(error('BUNDLE021', currentPath, 'SKILL.md identity does not match the bundle index.'));
      continue;
    }

    const manifest = bundle.manifests.find((candidate) => isRecord(candidate) && candidate.id === index.id);
    if (!manifest || !validateCapabilityManifest(manifest).ok) {
      diagnostics.push(error('BUNDLE022', `/manifests/${index.id}`, 'Missing or invalid capability manifest for this skill.'));
      continue;
    }

    const document = validation.document;
    const skill: SkillRecord = {
      id: index.id,
      name: document.name,
      description: document.description,
      version: document.version ?? '0.0.0',
      tags: document.tags,
      raw: document.raw,
      manifest,
      identity,
      createdAt: index.createdAt,
      updatedAt: index.updatedAt,
      origin: index.origin
    };

    const versionRecords: SkillVersionRecord[] = [];
    for (const entry of index.versions) {
      const hex = hashHex(entry.identity);
      const versionPath = `skills/${idFromPath}/versions/${hex}.md`;
      if (!/^[0-9a-f]{64}$/.test(hex) || !safePathSegment(hex)) {
        diagnostics.push(error('BUNDLE023', versionPath, 'Invalid version identity in index.'));
        continue;
      }
      const versionItem = items.get(versionPath);
      if (!versionItem) {
        diagnostics.push(error('BUNDLE024', versionPath, 'Versioned SKILL.md is missing from the bundle.'));
        continue;
      }
      const versionValidation = validateSkillMarkdown(decoder.decode(base64ToBytes(versionItem.bytes)));
      for (const diagnostic of versionValidation.diagnostics) {
        diagnostics.push({ ...diagnostic, path: `${versionPath}${diagnostic.path}` });
      }
      if (!versionValidation.ok || !versionValidation.document) continue;
      const versionIdentity = await skillIdentity(versionValidation.document);
      if (versionIdentity !== entry.identity) {
        diagnostics.push(error('BUNDLE025', versionPath, 'Version identity does not match its index entry.'));
        continue;
      }
      versionRecords.push({
        key: versionKey(index.id, versionIdentity),
        skillId: index.id,
        identity: versionIdentity,
        raw: versionValidation.document.raw,
        manifest,
        version: versionValidation.document.version ?? '0.0.0',
        createdAt: entry.createdAt,
        label: entry.label
      });
    }

    if (!index.versions.some((entry) => entry.identity === index.currentIdentity)) {
      diagnostics.push(
        error('BUNDLE026', `${indexItem.path}/versions`, 'The current identity must be present in version history.')
      );
      continue;
    }
    if (versionRecords.length !== index.versions.length) continue;

    plan.skills.push(skill);
    plan.versions.push(...versionRecords);
    diagnostics.push(note('BUNDLE000', indexItem.path, `Verified ${versionRecords.length} version(s) of "${document.name}".`));
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return hasErrors ? { ok: false, diagnostics } : { ok: true, diagnostics, plan };
}
