/** Shared template contracts for CoreBase and CoreSkills. See docs/specs/10. */

import type { PermissionRequest, Provenance, Requirement, Signature } from '@oneorigin/contracts';

export const TEMPLATE_SCHEMA = 'oneorigin.template/v0.0.2' as const;

export type TemplateProduct = 'corebase' | 'coreskills';

export type TemplateKind =
  | 'workspace'
  | 'execution-environment'
  | 'policy'
  | 'project-foundation'
  | 'skill'
  | 'capability-definition'
  | 'instruction'
  | 'workflow'
  | 'agent-competency';

export type TemplateInputType = 'string' | 'number' | 'boolean' | 'json' | 'file';

/** Structured, understandable inputs for people and authorized AI agents. */
export interface TemplateInput {
  name: string;
  type: TemplateInputType;
  description?: string;
  required?: boolean;
  default?: unknown;
}

/** Base64 bytes with content hash, matching the v0.0.1 bundle item shape. */
export interface TemplateFile {
  path: string;
  mediaType: string;
  bytes: string;
  sha256: string;
}

export interface TemplateDerivation {
  templateId: string;
  version: string;
  /** `sha256:<hex>` identity of the source template. */
  hash: string;
}

/**
 * A starting point, not a mandatory framework. Applying a template is still
 * subject to the normal approval and verification lifecycle for effects.
 */
export interface Template {
  schema: typeof TEMPLATE_SCHEMA;
  id: string;
  name: string;
  version: string;
  product: TemplateProduct;
  kind: TemplateKind;
  summary: string;
  description?: string;
  tags?: string[];
  inputs?: TemplateInput[];
  files: TemplateFile[];
  requires?: Requirement[];
  permissions?: PermissionRequest[];
  compatibility?: {
    products?: TemplateProduct[];
    contractVersions?: string[];
  };
  provenance?: Provenance;
  derivedFrom?: TemplateDerivation[];
  /** Integrity/origin only, never a safety claim. */
  signature?: Signature;
}
