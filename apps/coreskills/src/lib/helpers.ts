import type { CapabilityKind, Diagnostic, ValidationReport } from '@oneorigin/contracts';
import type { ImportCandidate, SkillRecord, SkillVersionRecord, SortKey } from './types.js';

export interface CatalogFilters {
  query: string;
  tags: string[];
  kind: CapabilityKind | 'all';
}

export const CAPABILITY_KINDS: readonly CapabilityKind[] = [
  'agent-skill',
  'human-skill',
  'system-capability',
  'workflow',
  'knowledge',
  'standard'
];

export type ImportDecision = 'blocked' | 'review' | 'ready';

/** Errors block an import; warnings need attention but do not block. */
export function importDecision(report: Pick<ValidationReport, 'diagnostics'>): ImportDecision {
  const severities = new Set(report.diagnostics.map((d) => d.severity));
  if (severities.has('error')) return 'blocked';
  if (severities.has('warning')) return 'review';
  return 'ready';
}

export function countBySeverity(diagnostics: Diagnostic[], severity: Diagnostic['severity']): number {
  return diagnostics.filter((d) => d.severity === severity).length;
}

export function importableCandidates(candidates: ImportCandidate[]): ImportCandidate[] {
  return candidates.filter((candidate) => candidate.included && importDecision(candidate.validation) !== 'blocked');
}

/** Case-insensitive substring search over name, description and tags. */
export function filterSkills(skills: SkillRecord[], filters: CatalogFilters): SkillRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const wantedTags = filters.tags.map((tag) => tag.toLocaleLowerCase());
  return skills.filter((skill) => {
    if (filters.kind !== 'all' && skill.manifest.kind !== filters.kind) return false;
    if (wantedTags.length > 0 && !wantedTags.some((tag) => skill.tags.some((t) => t.toLocaleLowerCase() === tag))) {
      return false;
    }
    if (query.length === 0) return true;
    const haystack = [skill.name, skill.description, skill.manifest.name, ...skill.tags]
      .join(' ')
      .toLocaleLowerCase();
    return haystack.includes(query);
  });
}

export function sortSkills(skills: SkillRecord[], sort: SortKey): SkillRecord[] {
  return [...skills].sort((a, b) => {
    if (sort === 'name') {
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    }
    return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

export function tagFacets(skills: SkillRecord[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const skill of skills) {
    for (const tag of new Set(skill.tags.map((t) => t.toLocaleLowerCase()))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Newest first, with identity as a deterministic tie-breaker. */
export function sortVersionsDesc(versions: SkillVersionRecord[]): SkillVersionRecord[] {
  return [...versions].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.identity.localeCompare(a.identity) || b.key.localeCompare(a.key)
  );
}

export function versionKey(id: string, identity: string): string {
  return `${id}@${identity}`;
}

export function hashHex(identity: string): string {
  return identity.startsWith('sha256:') ? identity.slice('sha256:'.length) : identity;
}

/** Reject anything that could escape the `skills/<id>/` bundle subtree. */
export function safePathSegment(value: string): string | undefined {
  if (!value || value.includes('/') || value.includes('\\') || value.includes('\0') || value === '.' || value === '..') {
    return undefined;
  }
  return /^[a-z0-9][a-z0-9._-]{2,127}$/.test(value) ? value : undefined;
}

export function shortHash(identity: string): string {
  const hex = hashHex(identity);
  return hex.length > 12 ? `${hex.slice(0, 8)}…${hex.slice(-4)}` : hex;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
