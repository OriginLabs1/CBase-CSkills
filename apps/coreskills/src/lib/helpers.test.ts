import { CAPABILITY_SCHEMA, type CapabilityManifest } from '@oneorigin/contracts';
import { describe, expect, it } from 'vitest';
import {
  filterSkills,
  importDecision,
  importableCandidates,
  safePathSegment,
  sortSkills,
  sortVersionsDesc,
  tagFacets,
  versionKey
} from './helpers.js';
import type { ImportCandidate, SkillRecord, SkillVersionRecord } from './types.js';

function manifest(id: string, name: string): CapabilityManifest {
  return {
    schema: CAPABILITY_SCHEMA,
    id,
    name,
    version: '1.0.0',
    kind: 'agent-skill',
    summary: 'Fixture skill'
  };
}

function skill(overrides: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: 'skill.alpha',
    name: 'alpha-skill',
    description: 'A structured review helper for widgets.',
    version: '1.0.0',
    tags: ['alpha', 'review'],
    raw: 'raw',
    manifest: manifest('skill.alpha', 'Alpha'),
    identity: `sha256:${'a'.repeat(64)}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    origin: 'local',
    ...overrides
  };
}

function version(identity: string, createdAt: string): SkillVersionRecord {
  return {
    key: versionKey('skill.alpha', identity),
    skillId: 'skill.alpha',
    identity,
    raw: 'raw',
    manifest: manifest('skill.alpha', 'Alpha'),
    version: '1.0.0',
    createdAt,
    label: 'Saved version'
  };
}

function candidate(included: boolean, severities: ImportCandidate['validation']['diagnostics'][number]['severity'][]): ImportCandidate {
  return {
    key: 'fixture',
    filename: 'SKILL.md',
    raw: 'raw',
    validation: {
      ok: !severities.includes('error'),
      diagnostics: severities.map((severity, index) => ({
        code: `TEST${index}`,
        severity,
        path: `/test/${index}`,
        message: 'Fixture diagnostic'
      }))
    },
    included
  };
}

describe('import decision logic', () => {
  it('blocks any candidate that has an error', () => {
    expect(importDecision({ diagnostics: [{ code: 'FM002', severity: 'error', path: '/name', message: 'bad name' }] })).toBe('blocked');
  });

  it('surfaces warnings for review but still allows import', () => {
    expect(importDecision({ diagnostics: [{ code: 'SEC001', severity: 'warning', path: '/body', message: 'review' }] })).toBe('review');
  });

  it('treats info-only diagnostics as ready', () => {
    expect(importDecision({ diagnostics: [{ code: 'FM005', severity: 'info', path: '/extra', message: 'preserved' }] })).toBe('ready');
  });

  it('honours the per-candidate include toggle', () => {
    const candidates = [candidate(true, ['warning']), candidate(false, []), candidate(true, ['error'])];
    expect(importableCandidates(candidates).map((item) => item.key)).toEqual(['fixture']);
  });
});

describe('catalog helpers', () => {
  const skills = [
    skill(),
    skill({
      id: 'skill.beta',
      name: 'beta-notes',
      description: 'Meeting summaries and action items.',
      tags: ['writing', 'review'],
      manifest: manifest('skill.beta', 'Beta'),
      updatedAt: '2026-03-01T00:00:00.000Z'
    }),
    skill({
      id: 'skill.gamma',
      name: 'gamma-checklist',
      description: 'Release checklist.',
      tags: ['release'],
      manifest: { ...manifest('skill.gamma', 'Gamma'), kind: 'workflow' },
      updatedAt: '2025-12-01T00:00:00.000Z'
    })
  ];

  it('searches name, description and tags case-insensitively', () => {
    expect(filterSkills(skills, { query: 'WIDGETS', tags: [], kind: 'all' }).map((s) => s.id)).toEqual(['skill.alpha']);
    expect(filterSkills(skills, { query: 'release', tags: [], kind: 'all' }).map((s) => s.id)).toEqual(['skill.gamma']);
    expect(filterSkills(skills, { query: 'nothing-matches', tags: [], kind: 'all' })).toEqual([]);
  });

  it('combines tag and capability-kind filters', () => {
    expect(filterSkills(skills, { query: '', tags: ['review'], kind: 'all' }).map((s) => s.id)).toEqual([
      'skill.alpha',
      'skill.beta'
    ]);
    expect(filterSkills(skills, { query: '', tags: ['review'], kind: 'workflow' })).toEqual([]);
  });

  it('sorts by name and by most recently updated without mutating input', () => {
    expect(sortSkills(skills, 'name').map((s) => s.name)).toEqual(['alpha-skill', 'beta-notes', 'gamma-checklist']);
    expect(sortSkills(skills, 'updated').map((s) => s.id)).toEqual(['skill.beta', 'skill.alpha', 'skill.gamma']);
    expect(skills.map((s) => s.id)).toEqual(['skill.alpha', 'skill.beta', 'skill.gamma']);
  });

  it('counts tag facets deterministically', () => {
    expect(tagFacets(skills)).toEqual([
      { tag: 'review', count: 2 },
      { tag: 'alpha', count: 1 },
      { tag: 'release', count: 1 },
      { tag: 'writing', count: 1 }
    ]);
  });
});

describe('version ordering and paths', () => {
  it('orders versions newest first with an identity tie-breaker', () => {
    const older = version(`sha256:${'1'.repeat(64)}`, '2026-01-01T00:00:00.000Z');
    const newer = version(`sha256:${'2'.repeat(64)}`, '2026-02-01T00:00:00.000Z');
    const sameTimeHigherHash = version(`sha256:${'3'.repeat(64)}`, '2026-02-01T00:00:00.000Z');
    expect(sortVersionsDesc([older, sameTimeHigherHash, newer]).map((v) => v.identity)).toEqual([
      sameTimeHigherHash.identity,
      newer.identity,
      older.identity
    ]);
  });

  it('rejects unsafe bundle path segments', () => {
    expect(safePathSegment('skill.code-review')).toBe('skill.code-review');
    expect(safePathSegment('../escape')).toBeUndefined();
    expect(safePathSegment('a/b')).toBeUndefined();
    expect(safePathSegment('x\0y')).toBeUndefined();
  });
});
