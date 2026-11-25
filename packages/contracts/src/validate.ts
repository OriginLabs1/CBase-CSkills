import {
  CAPABILITY_SCHEMA,
  PERMISSION_SCOPES,
  type CapabilityKind,
  type CapabilityManifest,
  type Diagnostic,
  type ValidationReport,
} from './types.js';

const KINDS: readonly CapabilityKind[] = [
  'agent-skill',
  'human-skill',
  'system-capability',
  'workflow',
  'knowledge',
  'standard',
];

const SEMVER = /^\d+\.\d+\.\d+$/;
const ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const TAG = /^[a-z0-9][a-z0-9._-]{0,31}$/;

function report(diagnostics: Diagnostic[]): ValidationReport {
  return {
    ok: !diagnostics.some((d) => d.severity === 'error'),
    diagnostics,
  };
}

/** Stable, canonical JSON used for checksums and audit hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).filter((k) => object[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(object[k])}`).join(',')}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a capability manifest without throwing. */
export function validateCapabilityManifest(value: unknown): ValidationReport {
  const d: Diagnostic[] = [];
  const push = (code: string, path: string, message: string, severity: Diagnostic['severity'] = 'error') =>
    d.push({ code, severity, path, message });

  if (!isRecord(value)) {
    push('CM001', '/', 'Manifest must be a JSON object.');
    return report(d);
  }

  if (value.schema !== CAPABILITY_SCHEMA) {
    push('CM002', '/schema', `schema must be exactly "${CAPABILITY_SCHEMA}".`);
  }
  if (typeof value.id !== 'string' || !ID.test(value.id)) {
    push('CM003', '/id', 'id must be 3–128 lowercase chars: letters, digits, ., _ or -.');
  }
  if (typeof value.name !== 'string' || value.name.length < 1 || value.name.length > 80) {
    push('CM004', '/name', 'name must be 1–80 characters.');
  }
  if (typeof value.version !== 'string' || !SEMVER.test(value.version)) {
    push('CM005', '/version', 'version must be SemVer without a leading v (e.g. 0.0.1).');
  }
  if (typeof value.kind !== 'string' || !KINDS.includes(value.kind as CapabilityKind)) {
    push('CM006', '/kind', 'kind must be one of the six capability domains.');
  }
  if (typeof value.summary !== 'string' || value.summary.length < 1 || value.summary.length > 200) {
    push('CM007', '/summary', 'summary must be 1–200 characters.');
  }
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 65_536)) {
    push('CM008', '/description', 'description must be text of at most 64 KiB.');
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.length > 32) {
      push('CM009', '/tags', 'tags must be an array of at most 32 entries.');
    } else {
      value.tags.forEach((tag, i) => {
        if (typeof tag !== 'string' || !TAG.test(tag)) push('CM010', `/tags/${i}`, 'Invalid tag.');
      });
    }
  }
  if (value.entry !== undefined) {
    if (
      typeof value.entry !== 'string' ||
      value.entry.startsWith('/') ||
      value.entry.split(/[\\/]/).includes('..') ||
      value.entry.includes('\0')
    ) {
      push('CM011', '/entry', 'entry must be a safe relative path.');
    }
  }
  if (value.permissions !== undefined) {
    if (!Array.isArray(value.permissions)) {
      push('CM012', '/permissions', 'permissions must be an array.');
    } else {
      value.permissions.forEach((permission, i) => {
        if (!isRecord(permission)) {
          push('CM013', `/permissions/${i}`, 'Permission must be an object.');
          return;
        }
        if (typeof permission.scope !== 'string' || !PERMISSION_SCOPES.includes(permission.scope as never)) {
          push('CM014', `/permissions/${i}/scope`, 'Unknown permission scope.');
        }
        if (!['none', 'ask', 'grant'].includes(permission.level as string)) {
          push('CM015', `/permissions/${i}/level`, 'level must be none, ask or grant.');
        }
        if (typeof permission.reason !== 'string' || permission.reason.trim().length === 0) {
          push('CM016', `/permissions/${i}/reason`, 'A permission request must explain why it is needed.');
        }
      });
    }
  }
  if (value.interfaces !== undefined) {
    if (!Array.isArray(value.interfaces)) {
      push('CM017', '/interfaces', 'interfaces must be an array.');
    } else {
      const types = ['command', 'function', 'http', 'mcp-tool', 'prompt', 'resource'];
      value.interfaces.forEach(item => {
        if (!isRecord(item)) {
          push('CM018', '/interfaces', 'Interface must be an object.');
          return;
        }
        if (typeof item.name !== 'string' || item.name.length === 0) push('CM019', '/interfaces/name', 'Interface needs a name.');
        if (typeof item.type !== 'string' || !types.includes(item.type)) push('CM020', '/interfaces/type', 'Unknown interface type.');
        for (const key of ['inputSchema', 'outputSchema'] as const) {
          if (item[key] !== undefined && !isRecord(item[key])) push('CM021', `/interfaces/${key}`, 'Schema must be a JSON Schema object.');
        }
      });
    }
  }
  if (value.checksum !== undefined && (typeof value.checksum !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value.checksum))) {
    push('CM022', '/checksum', 'checksum must be sha256:<64 hex chars>.');
  }
  for (const key of Object.keys(value)) {
    if (![
      'schema', 'id', 'name', 'version', 'kind', 'summary', 'description', 'authors',
      'license', 'tags', 'entry', 'requires', 'permissions', 'interfaces',
      'provenance', 'checksum', 'extensions',
    ].includes(key)) {
      push('CM023', `/${key}`, 'Unknown top-level field; preserve it in extensions.', 'info');
    }
  }
  return report(d);
}

/** True when a value is a well-formed manifest. */
export function isCapabilityManifest(value: unknown): value is CapabilityManifest {
  return validateCapabilityManifest(value).ok;
}

/** Maps a SKILL.md-like document to a manifest. Kept here so both apps agree. */
export function skillToManifest(input: {
  name: string;
  description: string;
  version?: string;
  tags?: string[];
  id?: string;
  permissions?: CapabilityManifest['permissions'];
}): CapabilityManifest {
  const firstSentence = input.description.split(/(?<=[.!?])\s/)[0] ?? input.description;
  return {
    schema: CAPABILITY_SCHEMA,
    id: input.id ?? `skill.${input.name}`,
    name: input.name,
    version: input.version ?? '0.0.0',
    kind: 'agent-skill',
    summary: firstSentence.slice(0, 200),
    tags: input.tags ?? [],
    permissions: input.permissions ?? [],
    interfaces: [{ name: 'instructions', type: 'resource' }],
    extensions: { agentSkills: { skillMd: true } },
  };
}
