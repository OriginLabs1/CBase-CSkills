import { describe, expect, it, vi } from 'vitest';
import { randomId } from './ids.js';
import { canonicalJson, skillToManifest, validateCapabilityManifest } from './validate.js';

const valid = {
  schema: 'oneorigin.capability/v0.0.1',
  id: 'oneorigin.skills.example',
  name: 'Example',
  version: '0.0.1',
  kind: 'agent-skill',
  summary: 'An example capability.',
  permissions: [{ scope: 'workspace.read', level: 'ask', reason: 'Read a user-chosen file.' }],
  interfaces: [{ name: 'instructions', type: 'resource' }],
};

describe('validateCapabilityManifest', () => {
  it('accepts a minimal valid manifest', () => {
    expect(validateCapabilityManifest(valid).ok).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = validateCapabilityManifest({ ...valid, summary: '' });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('CM007');
  });

  it('rejects bad permission scopes and levels', () => {
    const result = validateCapabilityManifest({
      ...valid,
      permissions: [{ scope: 'root', level: 'always', reason: '' }],
    });
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['CM014', 'CM015', 'CM016']));
  });

  it('reports unknown fields as info, not errors', () => {
    const result = validateCapabilityManifest({ ...valid, futureField: true });
    expect(result.ok).toBe(true);
    expect(result.diagnostics[0].severity).toBe('info');
  });
});

describe('randomId', () => {
  it('returns unique non-empty identifiers', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId()));
    expect(ids.size).toBe(100);
    expect([...ids].every((id) => id.length > 8)).toBe(true);
  });

  it('works where randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint32Array) => {
        array[0] = 0x12345678;
        return array;
      },
    });
    try {
      expect(randomId()).toMatch(/^[0-9a-f]+-[0-9a-f]{16}-[0-9a-f]+$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively and preserves array order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 }, list: [3, 1, 2] }))
      .toBe('{"a":{"c":3,"d":2},"b":1,"list":[3,1,2]}');
  });
});

describe('skillToManifest', () => {
  it('maps a skill into the manifest contract', () => {
    const manifest = skillToManifest({ name: 'my-skill', description: 'Does a thing. More detail.' });
    expect(manifest.id).toBe('skill.my-skill');
    expect(manifest.kind).toBe('agent-skill');
    expect(manifest.summary).toBe('Does a thing.');
    expect(validateCapabilityManifest(manifest).ok).toBe(true);
  });
});
