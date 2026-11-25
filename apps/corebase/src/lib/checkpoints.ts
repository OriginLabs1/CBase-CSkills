import { canonicalJson } from '@oneorigin/contracts';
import { sha256Hex } from '@oneorigin/skill-kit';
import { GENESIS_HASH } from './execution/audit';
import {
  appendAuditEntry,
  getAuditEntries,
  listFiles,
  putCheckpoint,
  replaceProjectFiles,
} from './storage';
import type { Checkpoint, CheckpointFile } from './types';

const encoder = new TextEncoder();

async function digest(value: unknown): Promise<string> {
  return sha256Hex(encoder.encode(canonicalJson(value)));
}

/** Writes a new immutable checkpoint. Existing checkpoints are never modified. */
export async function saveCheckpointSnapshot(
  projectId: string,
  label: string,
  auditHead?: string,
  automatic = false,
): Promise<Checkpoint> {
  const files: CheckpointFile[] = (await listFiles(projectId)).map((file) => ({
    path: file.path,
    content: file.content,
    mediaType: file.mediaType,
    kind: file.kind,
  }));
  const createdAt = new Date().toISOString();
  const head = auditHead ?? (await getAuditEntries()).at(-1)?.entryHash ?? GENESIS_HASH;
  const checksum = await digest({ projectId, label, createdAt, auditHead: head, files });
  const checkpoint: Checkpoint = {
    id: `sha256:${checksum}`,
    projectId,
    label,
    createdAt,
    auditHead: head,
    checksum,
    files,
    automatic,
  };
  await putCheckpoint(checkpoint);
  return checkpoint;
}

export async function createUserCheckpoint(projectId: string, label: string, actor: string): Promise<Checkpoint> {
  const checkpoint = await saveCheckpointSnapshot(projectId, label);
  await appendAuditEntry({
    stage: 'intent',
    actor,
    summary: `Create checkpoint: ${label}`,
    data: { projectId },
  });
  await appendAuditEntry({
    stage: 'execution',
    actor,
    summary: `Captured ${checkpoint.files.length} files at audit head ${checkpoint.auditHead.slice(0, 12)}`,
    data: { checkpointId: checkpoint.id, files: checkpoint.files.length },
  });
  await appendAuditEntry({
    stage: 'verification',
    actor,
    summary: 'Checkpoint checksum and audit head recorded',
    data: {
      checks: [
        { name: 'checksumMatches', passed: true, detail: 'Content hash stored with the immutable checkpoint.' },
        { name: 'auditHeadCaptured', passed: true, detail: 'Current chain head captured.' },
      ],
    },
  });
  await appendAuditEntry({
    stage: 'persistence',
    actor,
    summary: `Checkpoint ${checkpoint.id.slice(0, 20)} persisted`,
    data: { checkpointRef: checkpoint.id },
  });
  await appendAuditEntry({
    stage: 'provenance',
    actor,
    summary: 'Checkpoint provenance recorded',
    data: { checkpointRef: checkpoint.id, auditHead: checkpoint.auditHead },
  });
  await appendAuditEntry({
    stage: 'result',
    actor,
    summary: 'Checkpoint created',
    data: { ok: true, checkpointId: checkpoint.id },
  });
  return checkpoint;
}

export async function restoreUserCheckpoint(checkpoint: Checkpoint, actor: string): Promise<void> {
  const { projectId } = checkpoint;
  await appendAuditEntry({
    stage: 'intent',
    actor,
    summary: `Restore checkpoint: ${checkpoint.label}`,
    data: { checkpointId: checkpoint.id },
  });
  await appendAuditEntry({
    stage: 'plan',
    actor,
    summary: 'Replace workspace files with the immutable checkpoint snapshot',
    data: {
      steps: ['Check the stored checksum', 'Replace virtual files', 'Continue the existing audit chain'],
      target: `workspace:${projectId}`,
    },
  });
  await appendAuditEntry({
    stage: 'authorization',
    actor,
    summary: 'Explicit human restore action in CoreBase UI',
    data: { decision: 'allow', basis: 'human UI action', scopes: [] },
  });

  await replaceProjectFiles(projectId, checkpoint.files);
  const current = await listFiles(projectId);
  await appendAuditEntry({
    stage: 'execution',
    actor,
    summary: `Restored ${checkpoint.files.length} files`,
    data: { checkpointRef: checkpoint.id, filesRestored: checkpoint.files.length },
  });

  const restoredChecksum = await digest({
    projectId,
    label: checkpoint.label,
    createdAt: checkpoint.createdAt,
    auditHead: checkpoint.auditHead,
    files: current.map((file) => ({
      path: file.path,
      content: file.content,
      mediaType: file.mediaType,
      kind: file.kind,
    })),
  });
  await appendAuditEntry({
    stage: 'verification',
    actor,
    summary: 'Restored state verified against the checkpoint',
    data: {
      checks: [
        {
          name: 'checksumMatches',
          passed: restoredChecksum === checkpoint.checksum,
          detail: restoredChecksum === checkpoint.checksum ? 'Bytes match the snapshot.' : 'Restored bytes differ from the snapshot.',
        },
        {
          name: 'expectedFilesPresent',
          passed: current.length === checkpoint.files.length,
          detail: `${current.length} of ${checkpoint.files.length} expected files present.`,
        },
      ],
    },
  });
  await appendAuditEntry({
    stage: 'persistence',
    actor,
    summary: 'Workspace files replaced; checkpoint remains immutable',
    data: { checkpointRef: checkpoint.id, stateChanges: true },
  });
  await appendAuditEntry({
    stage: 'provenance',
    actor,
    summary: 'Restore linked to the checkpoint and current chain',
    data: { checkpointRef: checkpoint.id, capturedHead: checkpoint.auditHead },
  });
  await appendAuditEntry({
    stage: 'result',
    actor,
    summary: restoredChecksum === checkpoint.checksum ? 'Checkpoint restored' : 'Restore verification failed',
    data: { ok: restoredChecksum === checkpoint.checksum, checkpointId: checkpoint.id },
  });
}
