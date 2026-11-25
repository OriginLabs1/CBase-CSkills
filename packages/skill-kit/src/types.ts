import type { PermissionRequest, ValidationReport } from '@oneorigin/contracts';

export interface SkillDocument {
  /** Original source text, preserved verbatim for round-trip export. */
  raw: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  authors?: string[];
  license?: string;
  tags: string[];
  allowedTools?: string[];
  compatibility?: string;
  permissions?: PermissionRequest[];
  id?: string;
  metadata: Record<string, unknown>;
  body: string;
  /** Directory name in directory form, when known. */
  sourceDirectory?: string;
}

export interface SkillValidation extends ValidationReport {
  document?: SkillDocument;
}

export interface SkillFixture {
  name: string;
  markdown: string;
  directoryName?: string;
}
