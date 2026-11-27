import { describe, expect, it } from 'vitest';
import { bytesToBase64, contentHash } from '@oneorigin/contracts';
import {
  canCombine,
  combineTemplates,
  renderTemplate,
  safeTemplatePath,
  templateIdentity,
  validateTemplate,
  validateTemplateInputs,
  verifyTemplateFiles,
  type Template,
} from './index.js';

const encoder = new TextEncoder();

async function file(path: string, text: string) {
  const bytes = encoder.encode(text);
  return { path, mediaType: 'text/markdown', bytes: bytesToBase64(bytes), sha256: await contentHash(bytes) };
}

async function template(overrides: Partial<Template> = {}): Promise<Template> {
  return {
    schema: 'oneorigin.template/v0.0.2',
    id: 'oneorigin.templates.example',
    name: 'Example',
    version: '0.0.1',
    product: 'coreskills',
    kind: 'skill',
    summary: 'An example template.',
    files: [await file('SKILL.md', '# {{ skillName }}\n\nUse this skill.\n')],
    inputs: [{ name: 'skillName', type: 'string', required: true }],
    ...overrides,
  };
}

describe('template validation', () => {
  it('accepts a minimal valid template', async () => {
    expect(validateTemplate(await template()).ok).toBe(true);
  });

  it('rejects unsafe paths and bad base64', async () => {
    const base = await template();
    const result = validateTemplate({
      ...base,
      files: [{ ...base.files[0], path: '../escape.md', bytes: '!!!' }],
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(['TP020', 'TP023']));
    expect(safeTemplatePath('folder/file.md')).toBe(true);
    expect(safeTemplatePath('/absolute.md')).toBe(false);
    expect(safeTemplatePath('a/../b.md')).toBe(false);
  });

  it('verifies file hashes before apply', async () => {
    const base = await template();
    const tampered: Template = {
      ...base,
      files: [{ ...base.files[0], bytes: bytesToBase64(encoder.encode('changed')) }],
    };
    expect(validateTemplate(tampered).ok).toBe(true);
    const verification = await verifyTemplateFiles(tampered);
    expect(verification.diagnostics.map((d) => d.code)).toContain('TF002');
    expect((await verifyTemplateFiles(base)).ok).toBe(true);
  });

  it('checks required and typed inputs', async () => {
    const base = await template();
    expect(validateTemplateInputs(base, {}).ok).toBe(false);
    expect(validateTemplateInputs(base, { skillName: 'demo' }).ok).toBe(true);
    expect(validateTemplateInputs(base, { skillName: 12 }).ok).toBe(false);
  });
});

describe('template lifecycle', () => {
  it('renders structured inputs and rehashes changed files', async () => {
    const base = await template();
    const rendered = await renderTemplate(base, { skillName: 'pdf-tools' });
    const text = new TextDecoder().decode(
      Uint8Array.from(atob(rendered.files[0].bytes), (c) => c.charCodeAt(0)),
    );
    expect(text).toContain('# pdf-tools');
    expect(rendered.files[0].sha256).not.toBe(base.files[0].sha256);
    expect((await verifyTemplateFiles(rendered)).ok).toBe(true);
  });

  it('produces stable identities independent of signatures', async () => {
    const base = await template();
    const signed: Template = {
      ...base,
      signature: { algorithm: 'sha256', value: 'abc', signer: 'oneorigin' },
    };
    expect(await templateIdentity(base)).toBe(await templateIdentity(signed));
  });

  it('combines compatible templates with provenance and rejects conflicts', async () => {
    const first = await template({ id: 'oneorigin.templates.first' });
    const second = await template({
      id: 'oneorigin.templates.second',
      name: 'Second',
      summary: 'Second template.',
      files: [await file('WORKFLOW.md', '# Workflow')],
      kind: 'workflow',
    });
    expect(canCombine(first, second)).toBe(true);
    const combined = await combineTemplates({
      sources: [first, second],
      id: 'oneorigin.templates.combined',
      name: 'Combined',
      version: '0.0.1',
      summary: 'Both templates.',
    });
    expect(combined.files).toHaveLength(2);
    expect(combined.derivedFrom).toHaveLength(2);
    expect(validateTemplate(combined).ok).toBe(true);

    const conflicting = await template({ id: 'oneorigin.templates.third' });
    expect(canCombine(first, conflicting)).toBe(false);
  });
});
