import { CAPABILITY_SCHEMA, type CapabilityManifest } from '@oneorigin/contracts';
import { parseSkillMarkdown, sha256Hex, skillIdentity, toCapabilityManifest } from '@oneorigin/skill-kit';
import { describe, expect, it } from 'vitest';
import { createSkillBundle, planBundleImport } from './bundle.js';
import { versionKey } from './helpers.js';
import { SAMPLE_SKILLS } from './samples.js';
import type { SkillRecord, SkillVersionRecord } from './types.js';

const sample = SAMPLE_SKILLS[0];
const document = parseSkillMarkdown(sample.markdown)!;

async function fixture(): Promise<{ skill: SkillRecord; version: SkillVersionRecord; manifest: CapabilityManifest }> {
  const identity = await skillIdentity(document);
  const manifest = toCapabilityManifest(document);
  const skill: SkillRecord = {
    id: manifest.id,
    name: document.name,
    description: document.description,
    version: document.version ?? '0.0.0',
    tags: document.tags,
    raw: document.raw,
    manifest,
    identity,
    createdAt: sample.createdAt,
    updatedAt: sample.createdAt,
    origin: 'imported'
  };
  return {
    skill,
    manifest,
    version: {
      key: versionKey(skill.id, identity),
      skillId: skill.id,
      identity,
      raw: document.raw,
      manifest,
      version: skill.version,
      createdAt: sample.createdAt,
      label: 'Imported'
    }
  };
}

describe('portable skill bundles', () => {
  it('creates a signed skill-pack with item hashes and manifests', async () => {
    const { skill, version } = await fixture();
    const bundle = await createSkillBundle([skill], [version], '2026-03-01T00:00:00.000Z');
    expect(bundle.schema).toBe('oneorigin.bundle/v0.0.1');
    expect(bundle.kind).toBe('skill-pack');
    expect(bundle.signature?.algorithm).toBe('sha256');
    expect(bundle.items.map((item) => item.path)).toContain(`skills/${skill.id}/SKILL.md`);
    expect(bundle.items.some((item) => item.path.startsWith(`skills/${skill.id}/versions/`))).toBe(true);
    expect(bundle.manifests[0].schema).toBe(CAPABILITY_SCHEMA);
  });

  it('verifies a whole bundle before producing a write plan', async () => {
    const { skill, version } = await fixture();
    const bundle = await createSkillBundle([skill], [version], '2026-03-01T00:00:00.000Z');
    const result = await planBundleImport(bundle);
    expect(result.ok).toBe(true);
    expect(result.plan?.skills.map((s) => s.id)).toEqual([skill.id]);
    expect(result.plan?.versions).toHaveLength(1);
  });

  it('rejects tampered bytes without returning a partial plan', async () => {
    const { skill, version } = await fixture();
    const bundle = await createSkillBundle([skill], [version], '2026-03-01T00:00:00.000Z');
    const tampered = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
    tampered.items[0].bytes = btoa('changed bytes');
    const result = await planBundleImport(tampered);
    expect(result.ok).toBe(false);
    expect(result.plan).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === 'BUNDLE009' || d.code === 'BUNDLE011')).toBe(true);
  });

  it('rejects an index whose current identity is not in the version history', async () => {
    const { skill, version } = await fixture();
    const bundle = await createSkillBundle([skill], [version], '2026-03-01T00:00:00.000Z');
    const broken = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
    const index = broken.items.find((item) => item.path.endsWith('/index.json'))!;
    const parsed = JSON.parse(atob(index.bytes)) as { versions: unknown[] };
    parsed.versions = [];
    const rewritten = new TextEncoder().encode(JSON.stringify(parsed));
    index.bytes = btoa(JSON.stringify(parsed));
    index.sha256 = await sha256Hex(rewritten);
    delete broken.signature;
    const result = await planBundleImport(broken);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('BUNDLE026');
  });
});
