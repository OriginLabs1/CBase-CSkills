import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AuditEntry, AuditStage, Grant } from '@oneorigin/contracts';
import { randomId } from '@oneorigin/contracts';
import { GENESIS_HASH, makeAuditEntry } from './execution/audit';
import { mediaTypeForPath, stateValue } from './helpers';
import type {
  AppSettings,
  Checkpoint,
  CheckpointFile,
  Project,
  TerminalLine,
  TerminalSession,
  VirtualFile,
} from './types';

interface CorebaseSchema extends DBSchema {
  projects: { key: string; value: Project };
  files: {
    key: string;
    value: VirtualFile;
    indexes: { 'by-project': string };
  };
  sessions: {
    key: string;
    value: TerminalSession;
    indexes: { 'by-project': string };
  };
  checkpoints: {
    key: string;
    value: Checkpoint;
    indexes: { 'by-project': string };
  };
  audit: { key: number; value: AuditEntry };
  grants: {
    key: string;
    value: Grant;
    indexes: { 'by-subject': string };
  };
  settings: { key: string; value: AppSettings };
}

export const STORE_NAMES = [
  'projects',
  'files',
  'sessions',
  'checkpoints',
  'audit',
  'grants',
  'settings',
] as const;

export const SETTINGS_KEY = 'settings' as const;

let connection: Promise<IDBPDatabase<CorebaseSchema>> | undefined;

export function openCorebase(): Promise<IDBPDatabase<CorebaseSchema>> {
  connection ??= openDB<CorebaseSchema>('oneorigin-corebase', 1, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      const files = db.createObjectStore('files');
      files.createIndex('by-project', 'projectId');
      const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('by-project', 'projectId');
      const checkpoints = db.createObjectStore('checkpoints', { keyPath: 'id' });
      checkpoints.createIndex('by-project', 'projectId');
      db.createObjectStore('audit', { keyPath: 'seq' });
      const grants = db.createObjectStore('grants', { keyPath: 'id' });
      grants.createIndex('by-subject', 'subject');
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return connection;
}

export async function closeCorebase(): Promise<void> {
  if (!connection) return;
  const db = await connection;
  db.close();
  connection = undefined;
}

export function fileKey(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}

export function makeFile(projectId: string, path: string, content: string, kind: VirtualFile['kind']): VirtualFile {
  return {
    projectId,
    path,
    content,
    mediaType: kind === 'directory' ? 'inode/directory' : mediaTypeForPath(path),
    kind,
    updatedAt: new Date().toISOString(),
  };
}

function seedFiles(projectId: string): VirtualFile[] {
  const at = new Date().toISOString();
  const entries: Array<[string, string, VirtualFile['kind']]> = [
    [
      'README.md',
      '# Welcome to CoreBase\n\nThis is a local, guest-owned workspace. Everything you see is stored in this browser in IndexedDB.\n\n## Try it\n\nOpen the **Terminal** tab and run `help`. Commands run through a sandboxed virtual shell: no host processes, no network, no ambient filesystem access.\n\nConsequential commands such as `rm` ask for your approval before they run.\n',
      'file',
    ],
    [
      'notes/ideas.md',
      '# Ideas\n\n- Keep execution inspectable from intent to result.\n- Every audit entry is hash-chained to the previous one.\n- Checkpoints capture files plus the audit head.\n',
      'file',
    ],
    [
      'src/hello.js',
      'export function greet(name) {\n  return `Hello, ${name ?? "guest"}!`;\n}\n\nconsole.log(greet("CoreBase"));\n',
      'file',
    ],
    [
      'skills/demo/SKILL.md',
      '---\nname: local-demo\ndescription: An example skill document stored in the guest workspace.\n---\n\n# Local demo\n\nThis file is data only. CoreBase does not execute skill instructions.\n',
      'file',
    ],
  ];
  return entries.map(([path, content, kind]) => ({ ...makeFile(projectId, path, content, kind), updatedAt: at }));
}

/** Seeds exactly once, on a completely empty database. */
export async function seedIfNeeded(): Promise<void> {
  const db = await openCorebase();
  if ((await db.count('projects')) > 0) return;

  const at = new Date().toISOString();
  const project: Project = {
    id: 'proj_welcome',
    name: 'Welcome Workspace',
    description: 'A local demo project to explore CoreBase safely.',
    createdAt: at,
    updatedAt: at,
  };
  const files = seedFiles(project.id);
  const session: TerminalSession = {
    id: 'session_welcome',
    projectId: project.id,
    cwd: '',
    history: [],
    lines: [
      {
        id: 'seed-line-1',
        at,
        kind: 'system',
        text: 'CoreBase virtual shell ready. Type help to see the bounded command set.',
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
  const settings: AppSettings = {
    key: SETTINGS_KEY,
    activeAdapterId: 'virtual-shell',
    activeModelAdapterId: 'offline-plan',
    approvalsEnabled: true,
    contentTelemetry: false,
  };

  const tx = db.transaction(['projects', 'files', 'sessions', 'settings'], 'readwrite');
  await tx.objectStore('projects').put(project);
  for (const file of files) await tx.objectStore('files').put(file, fileKey(file.projectId, file.path));
  await tx.objectStore('sessions').put(session);
  await tx.objectStore('settings').put(settings);
  await tx.done;

  await appendAuditEntry({
    stage: 'intent',
    actor: 'system',
    summary: 'Guest workspace initialized',
    data: { projectId: project.id, files: files.length, seeded: true },
    at,
  });
}

export interface AppendAuditInput {
  stage: AuditStage;
  actor: string;
  summary: string;
  capabilityId?: string;
  data?: Record<string, unknown>;
  at?: string;
}

/** Appends to the hash chain using the current tail; never rewrites prior entries. */
export async function appendAuditEntry(input: AppendAuditInput): Promise<AuditEntry> {
  const db = await openCorebase();
  const keys = await db.getAllKeys('audit');
  const seq = keys.reduce((max, key) => Math.max(max, key), 0) + 1;
  const previous = seq > 1 ? await db.get('audit', seq - 1) : undefined;
  const entry = await makeAuditEntry({
    seq,
    at: input.at ?? new Date().toISOString(),
    stage: input.stage,
    actor: input.actor,
    capabilityId: input.capabilityId,
    summary: input.summary,
    data: input.data,
    previousHash: previous?.entryHash ?? GENESIS_HASH,
  });
  await db.put('audit', entry);
  return entry;
}

export async function getAuditEntries(): Promise<AuditEntry[]> {
  const db = await openCorebase();
  const entries = await db.getAll('audit');
  return entries.sort((a, b) => a.seq - b.seq);
}

export async function listProjects(): Promise<Project[]> {
  const db = await openCorebase();
  const projects = await db.getAll('projects');
  return projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openCorebase();
  await db.put('projects', project);
}

export async function listFiles(projectId: string): Promise<VirtualFile[]> {
  const db = await openCorebase();
  const files = await db.getAllFromIndex('files', 'by-project', projectId);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getFile(projectId: string, path: string): Promise<VirtualFile | undefined> {
  const db = await openCorebase();
  return db.get('files', fileKey(projectId, path));
}

export async function putFile(file: VirtualFile): Promise<void> {
  const db = await openCorebase();
  await db.put('files', file, fileKey(file.projectId, file.path));
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  const db = await openCorebase();
  await db.delete('files', fileKey(projectId, path));
}

/** path -> kind-prefixed content, used for the verification state check. */
export async function snapshotFiles(projectId: string): Promise<Record<string, string>> {
  const files = await listFiles(projectId);
  return Object.fromEntries(files.map((file) => [file.path, stateValue(file.kind, file.content)]));
}

export async function replaceProjectFiles(projectId: string, files: CheckpointFile[]): Promise<void> {
  const db = await openCorebase();
  const tx = db.transaction('files', 'readwrite');
  const keys = await tx.store.index('by-project').getAllKeys(projectId);
  for (const key of keys) await tx.store.delete(key as string);
  for (const file of files) await tx.store.put(makeFile(projectId, file.path, file.content, file.kind), fileKey(projectId, file.path));
  await tx.done;
}

export async function listSessions(projectId: string): Promise<TerminalSession[]> {
  const db = await openCorebase();
  const sessions = await db.getAllFromIndex('sessions', 'by-project', projectId);
  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSession(id: string): Promise<TerminalSession | undefined> {
  const db = await openCorebase();
  return db.get('sessions', id);
}

export async function putSession(session: TerminalSession): Promise<void> {
  const db = await openCorebase();
  await db.put('sessions', session);
}

export async function listGrants(): Promise<Grant[]> {
  const db = await openCorebase();
  const grants = await db.getAll('grants');
  return grants.sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
}

export async function getGrant(id: string): Promise<Grant | undefined> {
  const db = await openCorebase();
  return db.get('grants', id);
}

export async function putGrant(grant: Grant): Promise<void> {
  const db = await openCorebase();
  await db.put('grants', grant);
}

export async function getSettings(): Promise<AppSettings> {
  const db = await openCorebase();
  const settings = await db.get('settings', SETTINGS_KEY);
  return (
    settings ?? {
      key: SETTINGS_KEY,
      activeAdapterId: 'virtual-shell',
      activeModelAdapterId: 'offline-plan',
      approvalsEnabled: true,
      contentTelemetry: false,
    }
  );
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await openCorebase();
  await db.put('settings', settings);
}

export async function putCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const db = await openCorebase();
  await db.put('checkpoints', checkpoint);
}

export async function listCheckpoints(projectId: string): Promise<Checkpoint[]> {
  const db = await openCorebase();
  const checkpoints = await db.getAllFromIndex('checkpoints', 'by-project', projectId);
  return checkpoints.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function terminalLine(kind: TerminalLine['kind'], text: string): TerminalLine {
  return { id: randomId(), at: new Date().toISOString(), kind, text };
}
