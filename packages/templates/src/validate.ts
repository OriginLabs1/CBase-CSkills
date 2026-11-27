import {
  PERMISSION_SCOPES,
  base64ToBytes,
  bytesToBase64,
  canonicalJson,
  contentHash,
  type Diagnostic,
  type ValidationReport,
} from '@oneorigin/contracts';
import { TEMPLATE_SCHEMA, type Template, type TemplateInput, type TemplateInputType } from './types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const TAG = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const SHA_REF = /^sha256:[0-9a-f]{64}$/;
const INPUT_NAME = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;
const TYPES: readonly TemplateInputType[] = ['string', 'number', 'boolean', 'json', 'file'];
const KINDS: readonly Template['kind'][] = [
  'workspace', 'execution-environment', 'policy', 'project-foundation',
  'skill', 'capability-definition', 'instruction', 'workflow', 'agent-competency',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function report(diagnostics: Diagnostic[]): ValidationReport {
  return { ok: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

type Push = (code: string, path: string, message: string, severity?: Diagnostic['severity']) => void;

export function safeTemplatePath(path: unknown): boolean {
  return typeof path === 'string'
    && path.length > 0
    && path.length <= 512
    && !path.startsWith('/')
    && !path.includes('\0')
    && !path.split(/[\\/]/).includes('..');
}

function isBase64(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    base64ToBytes(value);
    return true;
  } catch {
    return false;
  }
}

/** Structural validation. Byte hashes are checked separately by verifyTemplateFiles. */
export function validateTemplate(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  if (!isRecord(value)) {
    push('TP001', '/', 'Template must be a JSON object.');
    return report(d);
  }
  if (value.schema !== TEMPLATE_SCHEMA) push('TP002', '/schema', `schema must be "${TEMPLATE_SCHEMA}".`);
  if (typeof value.id !== 'string' || !ID.test(value.id)) push('TP003', '/id', 'id must be a stable lowercase identifier.');
  if (typeof value.name !== 'string' || value.name.length < 1 || value.name.length > 80) push('TP004', '/name', 'name must be 1–80 characters.');
  if (typeof value.version !== 'string' || !SEMVER.test(value.version)) push('TP005', '/version', 'version must be SemVer without a leading v.');
  if (value.product !== 'corebase' && value.product !== 'coreskills') push('TP006', '/product', 'product must be corebase or coreskills.');
  if (typeof value.kind !== 'string' || !KINDS.includes(value.kind as Template['kind'])) push('TP007', '/kind', 'Unknown template kind.');
  if (typeof value.summary !== 'string' || value.summary.length < 1 || value.summary.length > 200) push('TP008', '/summary', 'summary must be 1–200 characters.');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 65_536)) {
    push('TP009', '/description', 'description must be text of at most 64 KiB.');
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.length > 32 || value.tags.some((tag) => typeof tag !== 'string' || !TAG.test(tag))) {
      push('TP010', '/tags', 'tags must be at most 32 lowercase identifiers.');
    }
  }

  if (value.inputs !== undefined) {
    if (!Array.isArray(value.inputs)) {
      push('TP011', '/inputs', 'inputs must be an array.');
    } else {
      const names = new Set<string>();
      value.inputs.forEach((input, i) => {
        if (!isRecord(input)) {
          push('TP012', `/inputs/${i}`, 'Input must be an object.');
          return;
        }
        if (typeof input.name !== 'string' || !INPUT_NAME.test(input.name)) push('TP013', `/inputs/${i}/name`, 'Invalid input name.');
        else if (names.has(input.name)) push('TP014', `/inputs/${i}/name`, 'Duplicate input name.');
        else names.add(input.name);
        if (typeof input.type !== 'string' || !TYPES.includes(input.type as TemplateInputType)) push('TP015', `/inputs/${i}/type`, 'Unknown input type.');
        if (input.description !== undefined && typeof input.description !== 'string') push('TP016', `/inputs/${i}/description`, 'description must be text.');
        if (input.required !== undefined && typeof input.required !== 'boolean') push('TP017', `/inputs/${i}/required`, 'required must be a boolean.');
      });
    }
  }

  if (!Array.isArray(value.files) || value.files.length === 0) {
    push('TP018', '/files', 'A template must contain at least one file.');
  } else {
    const paths = new Set<string>();
    value.files.forEach((file, i) => {
      if (!isRecord(file)) {
        push('TP019', `/files/${i}`, 'File must be an object.');
        return;
      }
      if (!safeTemplatePath(file.path)) push('TP020', `/files/${i}/path`, 'File path must be relative and contain no .. or NUL.');
      else if (paths.has(file.path as string)) push('TP021', `/files/${i}/path`, 'Duplicate file path.');
      else paths.add(file.path as string);
      if (typeof file.mediaType !== 'string' || file.mediaType.length < 1 || file.mediaType.length > 128) push('TP022', `/files/${i}/mediaType`, 'Invalid media type.');
      if (!isBase64(file.bytes)) push('TP023', `/files/${i}/bytes`, 'bytes must be valid base64.');
      if (typeof file.sha256 !== 'string' || !SHA_REF.test(file.sha256)) push('TP024', `/files/${i}/sha256`, 'sha256 must be sha256:<64 hex chars>.');
    });
  }

  if (value.permissions !== undefined) {
    if (!Array.isArray(value.permissions)) {
      push('TP025', '/permissions', 'permissions must be an array.');
    } else {
      value.permissions.forEach((permission, i) => {
        if (!isRecord(permission)) {
          push('TP026', `/permissions/${i}`, 'Permission must be an object.');
          return;
        }
        if (typeof permission.scope !== 'string' || !PERMISSION_SCOPES.includes(permission.scope as never)) push('TP027', `/permissions/${i}/scope`, 'Unknown permission scope.');
        if (typeof permission.reason !== 'string' || permission.reason.trim().length === 0) push('TP028', `/permissions/${i}/reason`, 'A permission must explain why it is needed.');
      });
    }
  }
  if (value.derivedFrom !== undefined) {
    if (!Array.isArray(value.derivedFrom) || value.derivedFrom.some((item) => !isRecord(item)
      || typeof item.templateId !== 'string' || typeof item.version !== 'string'
      || typeof item.hash !== 'string' || !SHA_REF.test(item.hash))) {
      push('TP029', '/derivedFrom', 'derivedFrom must list template id, version and content hash.');
    }
  }
  if (value.signature !== undefined && (!isRecord(value.signature)
    || !['ed25519', 'sha256'].includes(value.signature.algorithm as string)
    || typeof value.signature.value !== 'string')) {
    push('TP030', '/signature', 'Invalid signature.');
  }
  return report(d);
}

/** Recomputes every file hash before a template is applied or published. */
export async function verifyTemplateFiles(template: Template): Promise<ValidationReport> {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  for (const [i, file] of template.files.entries()) {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(file.bytes);
    } catch {
      push('TF001', `/files/${i}/bytes`, 'File bytes are not valid base64.');
      continue;
    }
    const actual = await contentHash(bytes);
    if (actual !== file.sha256) push('TF002', `/files/${i}/sha256`, 'File hash does not match its bytes.');
  }
  return report(d);
}

/** Required and typed inputs; unknown keys are surfaced without failing. */
export function validateTemplateInputs(template: Template, values: Record<string, unknown>): ValidationReport {
  const d: Diagnostic[] = [];
  const push: Push = (code, path, message, severity = 'error') => d.push({ code, severity, path, message });
  const inputs = template.inputs ?? [];
  const known = new Set(inputs.map((input) => input.name));
  for (const [name, value] of Object.entries(values)) {
    if (!known.has(name)) push('TI001', `/${name}`, 'Unknown template input.', 'info');
  }
  for (const input of inputs) {
    const value = values[input.name];
    if (value === undefined) {
      if (input.required !== false && input.default === undefined) push('TI002', `/${input.name}`, 'Required input is missing.');
      continue;
    }
    const valid = input.type === 'string' ? typeof value === 'string'
      : input.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : input.type === 'boolean' ? typeof value === 'boolean'
          : input.type === 'json' ? isRecord(value) || Array.isArray(value)
            : isRecord(value) && typeof value.bytes === 'string' && typeof value.name === 'string';
    if (!valid) push('TI003', `/${input.name}`, `Input must be of type ${input.type}.`);
  }
  return report(d);
}

function inputToString(input: TemplateInput, value: unknown): string {
  if (input.type === 'json') return JSON.stringify(value);
  if (input.type === 'file' && isRecord(value)) return typeof value.bytes === 'string' ? value.bytes : '';
  return String(value);
}

function isText(mediaType: string): boolean {
  return mediaType.startsWith('text/') || mediaType === 'application/json'
    || mediaType === 'application/yaml' || mediaType === 'application/x-yaml';
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]*)\s*\}\}/g;

/**
 * Substitutes `{{inputName}}` in text files and rehashes them. A rendered
 * template drops its signature: the published bytes are now a derivative.
 */
export async function renderTemplate(template: Template, values: Record<string, unknown>): Promise<Template> {
  const validation = validateTemplateInputs(template, values);
  if (!validation.ok) throw new Error(`Invalid template inputs: ${validation.diagnostics.map((d) => d.code).join(', ')}`);
  const inputs = template.inputs ?? [];
  const resolved: Record<string, string> = {};
  for (const input of inputs) {
    const value = values[input.name] ?? input.default;
    if (value !== undefined) resolved[input.name] = inputToString(input, value);
  }
  const files = await Promise.all(template.files.map(async (file) => {
    if (!isText(file.mediaType)) return file;
    const source = decoder.decode(base64ToBytes(file.bytes));
    if (!source.includes('{{')) return file;
    const rendered = source.replace(PLACEHOLDER, (match, name: string) => resolved[name] ?? match);
    const bytes = encoder.encode(rendered);
    return { ...file, bytes: bytesToBase64(bytes), sha256: await contentHash(bytes) };
  }));
  const { signature: _signature, ...unsigned } = template;
  return { ...unsigned, files } as Template;
}

/** Identity of the exact canonical template bytes, excluding its signature. */
export async function templateIdentity(template: Template): Promise<string> {
  const { signature: _signature, ...unsigned } = template;
  return contentHash(encoder.encode(canonicalJson(unsigned)));
}

/** Compatibility check before combining templates. */
export function canCombine(...templates: Template[]): boolean {
  if (templates.length < 2) return false;
  const product = templates[0].product;
  const paths = new Set<string>();
  for (const template of templates) {
    if (template.product !== product) return false;
    if (template.compatibility?.products && !template.compatibility.products.includes(product)) return false;
    for (const file of template.files) {
      if (paths.has(file.path)) return false;
      paths.add(file.path);
    }
  }
  return true;
}

/** Creates a new derivative with explicit provenance for every source. */
export async function combineTemplates(input: {
  sources: Template[];
  id: string;
  name: string;
  version: string;
  summary: string;
}): Promise<Template> {
  if (!canCombine(...input.sources)) throw new Error('Templates are not combinable.');
  const sources = input.sources;
  const inputs = new Map<string, TemplateInput>();
  const permissions = new Map<string, NonNullable<Template['permissions']>[number]>();
  for (const template of sources) {
    for (const item of template.inputs ?? []) if (!inputs.has(item.name)) inputs.set(item.name, item);
    for (const permission of template.permissions ?? []) {
      const key = `${permission.scope}:${permission.level}:${permission.reason}`;
      if (!permissions.has(key)) permissions.set(key, permission);
    }
  }
  const derivedFrom = await Promise.all(sources.map(async (template) => ({
    templateId: template.id,
    version: template.version,
    hash: await templateIdentity(template),
  })));
  return {
    schema: TEMPLATE_SCHEMA,
    id: input.id,
    name: input.name,
    version: input.version,
    product: sources[0].product,
    kind: sources[0].kind,
    summary: input.summary,
    tags: [...new Set(sources.flatMap((template) => template.tags ?? []))],
    inputs: [...inputs.values()],
    files: sources.flatMap((template) => template.files),
    permissions: [...permissions.values()],
    derivedFrom,
  };
}
