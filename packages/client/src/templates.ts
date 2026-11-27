import { base64ToBytes, bytesToBase64, contentHash } from '@oneorigin/contracts';
import {
  TEMPLATE_SCHEMA,
  renderTemplate,
  type Template,
  type TemplateInput,
  type TemplateProduct,
} from '@oneorigin/templates';

interface TemplateSource {
  id: string;
  name: string;
  version: string;
  product: TemplateProduct;
  kind: Template['kind'];
  summary: string;
  description?: string;
  tags?: string[];
  inputs?: TemplateInput[];
  files: Array<{ path: string; mediaType: string; text: string }>;
}

async function build(source: TemplateSource): Promise<Template> {
  const files = await Promise.all(source.files.map(async (file) => {
    const bytes = new TextEncoder().encode(file.text);
    return { path: file.path, mediaType: file.mediaType, bytes: bytesToBase64(bytes), sha256: await contentHash(bytes) };
  }));
  return {
    schema: TEMPLATE_SCHEMA,
    id: source.id,
    name: source.name,
    version: source.version,
    product: source.product,
    kind: source.kind,
    summary: source.summary,
    ...(source.description ? { description: source.description } : {}),
    ...(source.tags ? { tags: source.tags } : {}),
    ...(source.inputs ? { inputs: source.inputs } : {}),
    files,
  };
}

const SOURCES: TemplateSource[] = [
  {
    id: 'oneorigin.templates.corebase.workspace',
    name: 'Guest workspace',
    version: '0.0.1',
    product: 'corebase',
    kind: 'workspace',
    summary: 'A small, reviewable project foundation for local work.',
    description: 'Creates documentation and an ideas note. It never executes commands or changes settings.',
    tags: ['workspace', 'guest'],
    inputs: [
      { name: 'projectName', type: 'string', description: 'Name of the new local project.', required: true },
      { name: 'purpose', type: 'string', description: 'One-line purpose recorded in the README.', required: true },
    ],
    files: [
      {
        path: 'README.md', mediaType: 'text/markdown',
        text: '# {{ projectName }}\n\n{{ purpose }}\n\nEverything in this project stays in this browser. Commands run only in the virtual shell and consequential actions still require approval.\n',
      },
      {
        path: 'notes/ideas.md', mediaType: 'text/markdown',
        text: '# Ideas\n\n- Record the intent before the command.\n- Review the audit chain after each session.\n- Save a checkpoint before structural changes.\n',
      },
    ],
  },
  {
    id: 'oneorigin.templates.corebase.review-policy',
    name: 'Review policy',
    version: '0.0.1',
    product: 'corebase',
    kind: 'policy',
    summary: 'A human-readable approval and revocation policy document.',
    inputs: [
      { name: 'approvalMinutes', type: 'number', description: 'How long a grant remains valid.', default: 10 },
    ],
    files: [
      {
        path: 'POLICY.md', mediaType: 'text/markdown',
        text: '# Local review policy\n\n- Consequential commands are denied unless explicitly approved.\n- Grants expire after {{ approvalMinutes }} minutes.\n- Revocation takes effect immediately; historical audit entries remain verifiable.\n- Checksums and signatures identify bytes and origin, never safety.\n',
      },
    ],
  },
  {
    id: 'oneorigin.templates.coreskills.skill',
    name: 'Skill document',
    version: '0.0.1',
    product: 'coreskills',
    kind: 'skill',
    summary: 'A valid SKILL.md starting point with typed inputs.',
    description: 'A starting point, not a framework. The rendered text is opened in the editor for review before saving.',
    tags: ['skill', 'starter'],
    inputs: [
      { name: 'skillName', type: 'string', description: 'Kebab-case skill name.', required: true },
      { name: 'purpose', type: 'string', description: 'What the skill helps a human do.', required: true },
      { name: 'version', type: 'string', description: 'Documented version.', default: '0.1.0' },
    ],
    files: [
      {
        path: 'SKILL.md', mediaType: 'text/markdown',
        text: `---
name: {{ skillName }}
description: {{ purpose }}
version: {{ version }}
tags: [draft, template]
---

# {{ skillName }}

This text is advisory. It is never executed by CoreSkills.

## Steps

1. State the input you expect.
2. State the output you want.
3. List assumptions, limits and required permissions.

## Verification

Describe how a human can check the result without trusting the instructions.
`,
      },
    ],
  },
  {
    id: 'oneorigin.templates.coreskills.workflow',
    name: 'Human review workflow',
    version: '0.0.1',
    product: 'coreskills',
    kind: 'workflow',
    summary: 'A review workflow document for agent competencies.',
    inputs: [
      { name: 'workflowName', type: 'string', description: 'Name of the workflow.', required: true },
    ],
    files: [
      {
        path: 'WORKFLOW.md', mediaType: 'text/markdown',
        text: '# {{ workflowName }}\n\n1. Describe the goal in plain language.\n2. List the capabilities requested and why.\n3. Ask a human to approve or deny each consequential action.\n4. Record the outcome and keep the evidence verifiable.\n',
      },
    ],
  },
];

/** Portable, integrity-checked starting points for both products. */
export async function builtinTemplates(product?: TemplateProduct): Promise<Template[]> {
  const templates = await Promise.all(SOURCES.filter((source) => !product || source.product === product).map(build));
  return templates;
}

export interface RenderedTextFile {
  path: string;
  mediaType: string;
  content: string;
}

/** Renders only text files and returns their decoded contents. */
export async function renderTextFiles(template: Template, values: Record<string, unknown>): Promise<RenderedTextFile[]> {
  const rendered = await renderTemplate(template, values);
  return rendered.files
    .filter((file) => file.mediaType.startsWith('text/') || file.mediaType === 'application/json')
    .map((file) => ({
      path: file.path,
      mediaType: file.mediaType,
      content: new TextDecoder().decode(base64ToBytes(file.bytes)),
    }));
}

/** Convenience for CoreSkills: the rendered SKILL.md text, ready for review. */
export async function renderSkillTemplate(template: Template, values: Record<string, unknown>): Promise<string> {
  const files = await renderTextFiles(template, values);
  const skill = files.find((file) => file.path.endsWith('SKILL.md'));
  if (!skill) throw new Error('This template has no SKILL.md file.');
  return skill.content;
}
