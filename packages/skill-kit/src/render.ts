import { skillToManifest, type CapabilityManifest } from '@oneorigin/contracts';
import { stringify } from 'yaml';
import type { SkillDocument } from './types.js';

/** Export preserves the original bytes when available. */
export function renderSkillMarkdown(document: SkillDocument): string {
  if (document.raw) return document.raw;
  const frontmatter: Record<string, unknown> = {
    name: document.name,
    description: document.description,
  };
  const optional: Array<[string, unknown]> = [
    ['version', document.version],
    ['author', document.author],
    ['authors', document.authors],
    ['license', document.license],
    ['tags', document.tags],
    ['allowed-tools', document.allowedTools],
    ['compatibility', document.compatibility],
    ['permissions', document.permissions],
    ['id', document.id],
  ];
  for (const [key, value] of optional) {
    if (value !== undefined && (!Array.isArray(value) || value.length > 0)) frontmatter[key] = value;
  }
  if (Object.keys(document.metadata).length > 0) frontmatter.metadata = document.metadata;
  return `---\n${stringify(frontmatter)}---\n${document.body}`;
}

/** Lossless SKILL.md → capability manifest mapping. */
export function toCapabilityManifest(document: SkillDocument): CapabilityManifest {
  return skillToManifest({
    name: document.name,
    description: document.description,
    version: document.version,
    tags: document.tags,
    id: document.id,
    permissions: document.permissions,
  });
}
