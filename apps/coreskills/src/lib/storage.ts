import { isCapabilityManifest } from '@oneorigin/contracts';
import { skillIdentity, toCapabilityManifest, validateSkillMarkdown } from '@oneorigin/skill-kit';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { versionKey } from './helpers.js';
import { SAMPLE_SKILLS } from './samples.js';
import type { SettingsRecord, SkillOrigin, SkillRecord, SkillVersionRecord } from './types.js';

interface CoreSkillsDB extends DBSchema {
  skills: { key: string; value: SkillRecord };
  'skill-versions': { key: string; value: SkillVersionRecord };
  settings: { key: string; value: SettingsRecord };
}

export const DB_NAME = 'oneorigin-coreskills';
const DB_VERSION = 1;
const SEED_SETTING = 'seed-version';
const SEED_VALUE = 'v1';

let connection: Promise<IDBPDatabase<CoreSkillsDB>> | undefined;

function database(): Promise<IDBPDatabase<CoreSkillsDB>> {
  connection ??= openDB<CoreSkillsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('skills')) db.createObjectStore('skills', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('skill-versions')) db.createObjectStore('skill-versions', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    }
  });
  return connection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOrigin(value: unknown): value is SkillOrigin {
  return value === 'local' || value === 'imported';
}

/** Stored bytes are opaque: validate shape before they reach the UI. */
export function isSkillRecord(value: unknown): value is SkillRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.version === 'string' &&
    isStringArray(value.tags) &&
    typeof value.raw === 'string' &&
    isCapabilityManifest(value.manifest) &&
    typeof value.identity === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    isOrigin(value.origin)
  );
}

export function isSkillVersionRecord(value: unknown): value is SkillVersionRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    typeof value.skillId === 'string' &&
    typeof value.identity === 'string' &&
    typeof value.raw === 'string' &&
    isCapabilityManifest(value.manifest) &&
    typeof value.version === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.label === 'string'
  );
}

interface PreparedSkill {
  skill: SkillRecord;
  version: SkillVersionRecord;
}

async function prepareSample(sample: (typeof SAMPLE_SKILLS)[number]): Promise<PreparedSkill | undefined> {
  const validation = validateSkillMarkdown(sample.markdown);
  if (!validation.ok || !validation.document) return undefined;
  const document = validation.document;
  const identity = await skillIdentity(document);
  const manifest = toCapabilityManifest(document);
  const id = document.id ?? manifest.id;
  const version = document.version ?? '0.0.0';
  return {
    skill: {
      id,
      name: document.name,
      description: document.description,
      version,
      tags: document.tags,
      raw: document.raw,
      manifest,
      identity,
      createdAt: sample.createdAt,
      updatedAt: sample.createdAt,
      origin: 'local'
    },
    version: {
      key: versionKey(id, identity),
      skillId: id,
      identity,
      raw: document.raw,
      manifest,
      version,
      createdAt: sample.createdAt,
      label: 'Example skill'
    }
  };
}

/** Write examples on a truly first run only; an existing catalog is left untouched. */
export async function ensureSeeded(): Promise<void> {
  const db = await database();
  const setting = await db.get('settings', SEED_SETTING);
  if (setting?.value === SEED_VALUE) return;

  const existingCount = await db.count('skills');
  const prepared = existingCount === 0 ? await Promise.all(SAMPLE_SKILLS.map(prepareSample)) : [];

  const tx = db.transaction(['skills', 'skill-versions', 'settings'], 'readwrite');
  for (const item of prepared) {
    if (!item) continue;
    await tx.objectStore('skills').put(item.skill);
    await tx.objectStore('skill-versions').put(item.version);
  }
  await tx.objectStore('settings').put({ key: SEED_SETTING, value: SEED_VALUE });
  await tx.done;
}

export async function listSkills(): Promise<SkillRecord[]> {
  const db = await database();
  const all = await db.getAll('skills');
  return all.filter(isSkillRecord);
}

export async function getSkill(id: string): Promise<SkillRecord | undefined> {
  const db = await database();
  const value = await db.get('skills', id);
  return isSkillRecord(value) ? value : undefined;
}

export async function listVersions(skillId: string): Promise<SkillVersionRecord[]> {
  const db = await database();
  const prefix = `${skillId}@`;
  const all = await db.getAll('skill-versions');
  return all.filter((value): value is SkillVersionRecord => isSkillVersionRecord(value) && value.key.startsWith(prefix));
}

export interface SaveSkillOptions {
  origin?: SkillOrigin;
  label?: string;
  createdAt?: string;
}

export interface SaveResult {
  skill: SkillRecord;
  version: SkillVersionRecord;
  created: boolean;
}

/** Validate, compute identity, and write an immutable version plus the current pointer. */
export async function saveSkill(raw: string, options: SaveSkillOptions = {}): Promise<SaveResult> {
  const validation = validateSkillMarkdown(raw);
  if (!validation.ok || !validation.document) {
    const firstError = validation.diagnostics.find((d) => d.severity === 'error');
    throw new Error(firstError ? `${firstError.code} ${firstError.path}: ${firstError.message}` : 'Invalid SKILL.md.');
  }

  const document = validation.document;
  const identity = await skillIdentity(document);
  const manifest = toCapabilityManifest(document);
  const id = document.id ?? manifest.id;
  const version = document.version ?? '0.0.0';
  const key = versionKey(id, identity);
  const now = new Date().toISOString();

  const db = await database();
  const tx = db.transaction(['skills', 'skill-versions'], 'readwrite');
  const skillStore = tx.objectStore('skills');
  const versionStore = tx.objectStore('skill-versions');
  const [existingSkill, existingVersion] = await Promise.all([skillStore.get(id), versionStore.get(key)]);

  const storedVersion = isSkillVersionRecord(existingVersion)
    ? existingVersion
    : {
        key,
        skillId: id,
        identity,
        raw: document.raw,
        manifest,
        version,
        createdAt: options.createdAt ?? now,
        label: options.label ?? 'Saved version'
      };

  const skill: SkillRecord = {
    id,
    name: document.name,
    description: document.description,
    version,
    tags: document.tags,
    raw: document.raw,
    manifest,
    identity,
    createdAt: isSkillRecord(existingSkill) ? existingSkill.createdAt : options.createdAt ?? now,
    updatedAt: now,
    origin: options.origin ?? (isSkillRecord(existingSkill) ? existingSkill.origin : 'local')
  };

  await versionStore.put(storedVersion);
  await skillStore.put(skill);
  await tx.done;
  return { skill, version: storedVersion, created: !existingVersion };
}

/** Point a skill at an older immutable version. No history is removed or rewritten. */
export async function restoreVersion(skillId: string, identity: string): Promise<SkillRecord> {
  const db = await database();
  const tx = db.transaction(['skills', 'skill-versions'], 'readwrite');
  const skillStore = tx.objectStore('skills');
  const versionStore = tx.objectStore('skill-versions');
  const [current, storedVersion] = await Promise.all([skillStore.get(skillId), versionStore.get(versionKey(skillId, identity))]);

  if (!isSkillRecord(current) || !isSkillVersionRecord(storedVersion)) {
    tx.abort();
    throw new Error('That version is no longer available.');
  }
  const validation = validateSkillMarkdown(storedVersion.raw);
  if (!validation.ok || !validation.document) {
    tx.abort();
    throw new Error('The stored version does not validate against SKILL.md conformance.');
  }

  const restored: SkillRecord = {
    ...current,
    name: validation.document.name,
    description: validation.document.description,
    version: validation.document.version ?? '0.0.0',
    tags: validation.document.tags,
    raw: storedVersion.raw,
    manifest: storedVersion.manifest,
    identity: storedVersion.identity,
    updatedAt: new Date().toISOString()
  };
  await skillStore.put(restored);
  await tx.done;
  return restored;
}

/** One transaction for a verified bundle: all items land together or none do. */
export async function putBundleRecords(skills: SkillRecord[], versions: SkillVersionRecord[]): Promise<void> {
  const db = await database();
  const tx = db.transaction(['skills', 'skill-versions'], 'readwrite');
  for (const version of versions) await tx.objectStore('skill-versions').put(version);
  for (const skill of skills) await tx.objectStore('skills').put(skill);
  await tx.done;
}

export async function storageStats(): Promise<{ skills: number; versions: number }> {
  const db = await database();
  const [skills, versions] = await Promise.all([db.count('skills'), db.count('skill-versions')]);
  return { skills, versions };
}

export async function closeStorage(): Promise<void> {
  const db = await database();
  db.close();
  connection = undefined;
}
