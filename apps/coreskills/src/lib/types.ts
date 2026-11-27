import type { CapabilityManifest } from '@oneorigin/contracts';
import type { SkillValidation } from '@oneorigin/skill-kit';

/** Where a skill record came from. Both origins are stored only on this device. */
export type SkillOrigin = 'local' | 'imported';

/** The current, editable pointer to a skill. Historical bytes live in `skill-versions`. */
export interface SkillRecord {
  /** Stable reverse-domain capability id, e.g. `skill.code-review`. */
  id: string;
  /** SKILL.md frontmatter name (kebab-case). */
  name: string;
  description: string;
  version: string;
  tags: string[];
  /** Verbatim SKILL.md text. */
  raw: string;
  manifest: CapabilityManifest;
  /** `sha256:<hex>` identity of the current canonical form. */
  identity: string;
  createdAt: string;
  updatedAt: string;
  origin: SkillOrigin;
}

/** Immutable, content-addressed snapshot of a skill. Key: `${id}@${identity}`. */
export interface SkillVersionRecord {
  key: string;
  skillId: string;
  identity: string;
  raw: string;
  manifest: CapabilityManifest;
  version: string;
  createdAt: string;
  label: string;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

export type ViewName = 'catalog' | 'import' | 'templates' | 'author' | 'about';
export type SortKey = 'name' | 'updated';
export type LayoutKey = 'grid' | 'list';

/** One SKILL.md or pasted text awaiting an import decision. */
export interface ImportCandidate {
  key: string;
  filename: string;
  raw: string;
  validation: SkillValidation;
  identity?: string;
  included: boolean;
}

/** Application metadata carried inside a portable skill-pack bundle. */
export interface BundleVersionEntry {
  identity: string;
  createdAt: string;
  label: string;
}

export interface BundleSkillIndex {
  id: string;
  name: string;
  currentIdentity: string;
  createdAt: string;
  updatedAt: string;
  origin: SkillOrigin;
  versions: BundleVersionEntry[];
}

export interface ToastMessage {
  message: string;
  tone: 'good' | 'bad' | 'info';
}
