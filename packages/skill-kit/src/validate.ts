import type { Diagnostic, PermissionRequest, ValidationReport } from '@oneorigin/contracts';
import { parse } from 'yaml';
import type { SkillDocument, SkillValidation } from './types.js';

export const MAX_SKILL_BYTES = 256 * 1024;

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const TAG = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const KNOWN_FIELDS = new Set([
  'name', 'description', 'version', 'author', 'authors', 'license', 'tags',
  'allowed-tools', 'compatibility', 'permissions', 'metadata', 'id',
]);
const SUSPICIOUS = /ignore\s+(all\s+)?previous\s+instructions|disregard\s+(all\s+)?(prior|previous)|system\s+prompt/i;
const CREDENTIALISH = /(^|[\s/`])(~|\/)(home|\.ssh|\.aws|\.config)?\/?.*(credentials|\.env|id_rsa|private_key|token)|process\.env|environment\s+secret/i;
const ABSOLUTE_PATH = /(^|[\s(])\/(usr|etc|home|root|var|tmp)\//;

function makeReport(diagnostics: Diagnostic[]): ValidationReport {
  return { ok: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.every((v) => typeof v === 'string') ? value as string[] : undefined;
}

/** Parse SKILL.md text into a normalized document without validating it. */
export function parseSkillMarkdown(raw: string, sourceDirectory?: string): SkillDocument | undefined {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = parse(match[1]);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const front = parsed as Record<string, unknown>;
  const body = raw.slice(match[0].length);
  const metadata = (front.metadata && typeof front.metadata === 'object' && !Array.isArray(front.metadata))
    ? front.metadata as Record<string, unknown>
    : {};
  const permissions = Array.isArray(front.permissions)
    ? front.permissions.filter((p): p is PermissionRequest => Boolean(p) && typeof p === 'object')
    : undefined;
  return {
    raw,
    name: text(front.name) ?? '',
    description: text(front.description) ?? '',
    version: text(front.version),
    author: text(front.author),
    authors: stringArray(front.authors),
    license: text(front.license),
    tags: stringArray(front.tags) ?? [],
    allowedTools: stringArray(front['allowed-tools']),
    compatibility: text(front.compatibility),
    permissions,
    id: text(front.id),
    metadata,
    body,
    sourceDirectory,
  };
}

/** Conformance check for SKILL.md. Deterministic for a given input. */
export function validateSkillMarkdown(raw: string, sourceDirectory?: string): SkillValidation {
  const d: Diagnostic[] = [];
  const push = (code: string, severity: Diagnostic['severity'], path: string, message: string) =>
    d.push({ code, severity, path, message });

  if (new TextEncoder().encode(raw).byteLength > MAX_SKILL_BYTES) {
    push('BODY002', 'error', '/', `Skill must not exceed ${MAX_SKILL_BYTES} bytes.`);
  }

  const document = parseSkillMarkdown(raw, sourceDirectory);
  if (!document) {
    const hasFence = /^---[ \t]*\r?\n/.test(raw);
    push(hasFence ? 'FM000' : 'FM001', 'error', '/frontmatter',
      hasFence ? 'Frontmatter is not valid YAML.' : 'Missing YAML frontmatter block.');
    return { ...makeReport(d) };
  }

  if (!NAME.test(document.name) || document.name.length > 64) {
    push('FM002', 'error', '/name', 'name must be lowercase kebab-case, 1–64 characters.');
  }
  if (sourceDirectory && sourceDirectory !== document.name) {
    push('FM007', 'error', '/name', `Directory name "${sourceDirectory}" must match skill name "${document.name}".`);
  }
  if (document.description.trim().length < 1 || document.description.length > 1024) {
    push('FM003', 'error', '/description', 'description must be 1–1024 characters.');
  } else if (document.description.length > 200) {
    push('FM004', 'warning', '/description', 'Long descriptions reduce discoverability; keep the first sentence short.');
  }
  if (document.version && !SEMVER.test(document.version)) {
    push('FM006', 'error', '/version', 'version must be SemVer without a leading v.');
  }
  document.tags.forEach((tag, i) => {
    if (!TAG.test(tag)) push('FM008', 'warning', `/tags/${i}`, 'Invalid tag; it will be ignored for indexing.');
  });

  // Unknown fields are informational and preserved in metadata.extensions.
  const fence = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (fence) {
    try {
      const front = parse(fence[1]) as Record<string, unknown>;
      for (const key of Object.keys(front)) {
        if (!KNOWN_FIELDS.has(key)) {
          push('FM005', 'info', `/${key}`, 'Unknown field preserved as an extension.');
        }
      }
    } catch { /* FM000 already reported by parse failure */ }
  }

  if (document.body.trim().length === 0) {
    push('BODY001', 'error', '/body', 'Skill instructions must not be empty.');
  }
  if (SUSPICIOUS.test(document.body)) {
    push('SEC001', 'warning', '/body', 'Body contains instruction-override language; review before trusting this skill.');
  }
  if (CREDENTIALISH.test(document.body)) {
    push('SEC002', 'warning', '/body', 'Body references credential-like locations or environment secrets.');
  }
  if (ABSOLUTE_PATH.test(document.body)) {
    push('SEC003', 'info', '/body', 'Body contains an absolute path; prefer portable relative paths.');
  }

  return { ...makeReport(d), document };
}
