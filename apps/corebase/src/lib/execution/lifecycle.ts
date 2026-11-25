import {
  canonicalJson,
  type AuditEntry,
  type AuditStage,
  type ExecutionAdapter,
  type ExecutionOutput,
  type PermissionScope,
  type VerificationReport,
} from '@oneorigin/contracts';
import { sha256Hex } from '@oneorigin/skill-kit';
import { saveCheckpointSnapshot } from '../checkpoints';
import { evaluatePermission, parseCommand } from '../helpers';
import { denyApproval, grantApproval } from '../permissions';
import { appendAuditEntry, listGrants, snapshotFiles } from '../storage';
import type { ApprovalRequest, LifecycleStage } from '../types';
import { SHELL_CAPABILITY_ID, SHELL_VERSION } from './virtual-shell';
import { managedPlan } from './plan';

const encoder = new TextEncoder();

export interface RunCommandOptions {
  adapter: ExecutionAdapter;
  projectId: string;
  sessionId: string;
  actor?: string;
  cwd?: string;
  approvalsEnabled?: boolean;
  onStage?: (stage: LifecycleStage) => void;
  requestApproval: (request: ApprovalRequest) => Promise<boolean>;
}

export interface CommandResult {
  ok: boolean;
  status: 'success' | 'failed' | 'denied';
  stdout: string;
  stderr: string;
  exitCode: number;
  output: ExecutionOutput;
  verification: VerificationReport;
  trace: AuditEntry[];
  head: string;
  clear: boolean;
}

function capabilityFor(command: string): string {
  return command === 'rm' ? `${SHELL_CAPABILITY_ID}.rm` : SHELL_CAPABILITY_ID;
}

function resourceFor(projectId: string, target: string, destructive: boolean): string {
  return destructive ? `workspace:${projectId}:${target}` : `workspace:${projectId}`;
}

async function makeApprovalRequest(input: {
  capabilityId: string;
  scopes: PermissionScope[];
  target: string;
  reason: string;
  actor: string;
  projectId: string;
  adapterId: string;
}): Promise<ApprovalRequest> {
  const createdAt = new Date().toISOString();
  const fingerprint = await sha256Hex(
    encoder.encode(
      canonicalJson({
        capabilityId: input.capabilityId,
        scopes: input.scopes,
        target: input.target,
        actor: input.actor,
        projectId: input.projectId,
        createdAt,
      }),
    ),
  );
  return {
    id: `approval:${fingerprint}`,
    capabilityId: input.capabilityId,
    capabilityVersion: SHELL_VERSION,
    scope: input.scopes[0] ?? 'execution',
    scopes: input.scopes,
    adapterId: input.adapterId,
    target: input.target,
    reason: input.reason,
    actor: input.actor,
    projectId: input.projectId,
    createdAt,
    expiresInMinutes: 10,
  };
}

/**
 * Intent → Plan → Authorization → Execute → Verify → Persist → Provenance → Result.
 * Every stage is appended to the hash-chained audit store before the next stage begins.
 */
export async function runLifecycleCommand(raw: string, options: RunCommandOptions): Promise<CommandResult> {
  const actor = options.actor ?? 'guest';
  const projectId = options.projectId;
  const cwd = options.cwd ?? '';
  const subject = `session:${options.sessionId}`;
  const trace: AuditEntry[] = [];
  const now = new Date().toISOString();

  const record = async (stage: AuditStage, summary: string, data?: Record<string, unknown>, capabilityId?: string) => {
    const entry = await appendAuditEntry({ stage, actor, summary, data, capabilityId });
    trace.push(entry);
    options.onStage?.(stage);
    return entry;
  };

  const finishDenied = async (reason: string): Promise<CommandResult> => {
    await record('result', 'Command denied before execution', { ok: false, reason, exitCode: 126 });
    const emptyOutput: ExecutionOutput = {
      stdout: '',
      stderr: reason,
      exitCode: 126,
      startedAt: now,
      finishedAt: new Date().toISOString(),
    };
    return {
      ok: false,
      status: 'denied',
      stdout: '',
      stderr: reason,
      exitCode: 126,
      output: emptyOutput,
      verification: {
        ok: false,
        checks: [{ name: 'authorization', passed: false, detail: reason }],
      },
      trace,
      head: trace.at(-1)?.entryHash ?? '',
      clear: false,
    };
  };

  const parsed = parseCommand(raw);
  const capabilityId = capabilityFor(parsed.command);
  const adapter = options.adapter;

  await record('intent', `Intent: ${raw || '(empty command)'}`, {
    raw,
    actor,
    projectId,
    cwd,
    adapterId: adapter.id,
  });

  const plan = await adapter.plan({ command: raw, cwd });
  const managed = managedPlan(plan);
  managed.projectId = projectId;
  managed.cwd = cwd;
  managed.baseline = await snapshotFiles(projectId);
  await record(
    'plan',
    plan.steps.length > 0 ? `Plan: ${plan.steps.join(' → ')}` : 'Plan: no steps',
    {
      adapterId: plan.adapterId,
      steps: plan.steps,
      requiredScopes: plan.requiredScopes,
      target: plan.target,
      destructive: Boolean(managed.destructive),
      mutates: Boolean(managed.mutates),
    },
    capabilityId,
  );

  const resource = resourceFor(projectId, plan.target, Boolean(managed.destructive));
  const grants = await listGrants();
  const decisions = plan.requiredScopes.map((scope) => ({
    scope,
    decision: evaluatePermission({
      grants,
      subject,
      capabilityId,
      capabilityVersion: SHELL_VERSION,
      scope,
      resource,
      now,
      approvalsEnabled: options.approvalsEnabled,
    }),
  }));
  const explicitDeny = decisions.find((item) => item.decision.kind === 'deny');
  if (explicitDeny) {
    const reason = explicitDeny.decision.kind === 'deny' ? explicitDeny.decision.reason : 'Denied.';
    await record('authorization', `Authorization denied: ${reason}`, { decision: 'deny', scope: explicitDeny.scope, resource }, capabilityId);
    return finishDenied(reason);
  }

  const missing = decisions.filter((item) => item.decision.kind === 'approval-required');
  if (missing.length > 0) {
    options.onStage?.('awaiting-approval');
    const reason = managed.destructive
      ? `Deleting "${plan.target}" from the virtual workspace cannot be undone without a checkpoint.`
      : `The ${adapter.id} adapter declares ${missing.map((item) => item.scope).join(', ')} for this command.`;
    const request = await makeApprovalRequest({
      capabilityId,
      scopes: missing.map((item) => item.scope),
      target: resource,
      reason,
      actor,
      projectId,
      adapterId: adapter.id,
    });
    const approved = await options.requestApproval(request);
    if (approved) {
      const created = await grantApproval(request, subject);
      await record(
        'authorization',
        `Human approval granted for ${request.scopes.join(', ')} on ${request.target}`,
        { decision: 'allow', basis: 'human UI action', grantIds: created.map((grant) => grant.id), target: request.target },
        capabilityId,
      );
    } else {
      await denyApproval(request, subject);
      await record('authorization', 'Human approval denied', { decision: 'deny', target: request.target }, capabilityId);
      return finishDenied('Approval was denied by the user. No command was executed.');
    }
  } else {
    await record(
      'authorization',
      `Existing grants authorize ${plan.requiredScopes.join(', ')}`,
      { decision: 'allow', basis: 'active grants', resource },
      capabilityId,
    );
  }

  const output = await adapter.execute(plan, {
    workspaceId: projectId,
    sessionId: options.sessionId,
    approved: async (scope, target) => {
      const fresh = await listGrants();
      const decision = evaluatePermission({
        grants: fresh,
        subject,
        capabilityId,
        capabilityVersion: SHELL_VERSION,
        scope,
        resource: resourceFor(projectId, target, Boolean(managed.destructive)),
        now: new Date().toISOString(),
        approvalsEnabled: options.approvalsEnabled,
      });
      return decision.kind === 'allow';
    },
  });

  const inputHash = await sha256Hex(encoder.encode(canonicalJson({ raw, cwd, adapterId: adapter.id })));
  const outputHash = await sha256Hex(encoder.encode(canonicalJson({ stdout: output.stdout, stderr: output.stderr, exitCode: output.exitCode })));
  await record(
    'execution',
    `Executed via ${adapter.id} (exit ${output.exitCode})`,
    {
      adapterId: adapter.id,
      inputHash,
      outputHash,
      durationMs: Date.parse(output.finishedAt) - Date.parse(output.startedAt),
      exitCode: output.exitCode,
      stdout: output.stdout.slice(0, 4000),
      stderr: output.stderr.slice(0, 4000),
    },
    capabilityId,
  );

  const verification = await adapter.verify(plan, output);
  await record(
    'verification',
    verification.ok ? 'Verification passed' : 'Verification failed',
    { ok: verification.ok, checks: verification.checks },
    capabilityId,
  );

  const changed = Boolean(managed.mutates) && output.exitCode === 0 && verification.ok;
  let checkpointRef: string | undefined;
  if (changed) {
    const checkpoint = await saveCheckpointSnapshot(projectId, `Auto: ${parsed.command}`, trace.at(-1)?.entryHash, true);
    checkpointRef = checkpoint.id;
  }
  await record(
    'persistence',
    changed ? 'Workspace state persisted with checkpoint reference' : 'No workspace state changes to persist',
    { stateChanged: changed, checkpointRef: checkpointRef ?? null, head: trace.at(-1)?.entryHash ?? null },
    capabilityId,
  );

  await record(
    'provenance',
    'Provenance recorded with links to all prior stages',
    {
      adapterId: adapter.id,
      stages: trace.map((entry) => ({ seq: entry.seq, stage: entry.stage, hash: entry.entryHash })),
      previousHead: trace.at(-1)?.previousHash ?? null,
    },
    capabilityId,
  );

  const ok = verification.ok && output.exitCode === 0;
  const resultEntry = await record(
    'result',
    ok ? 'Command succeeded and was verified' : 'Command failed verification',
    {
      ok,
      exitCode: output.exitCode,
      verificationOk: verification.ok,
      checks: verification.checks.map((check) => ({ name: check.name, passed: check.passed })),
      auditSeq: trace.length + 1,
    },
    capabilityId,
  );

  return {
    ok,
    status: ok ? 'success' : 'failed',
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exitCode,
    output,
    verification,
    trace,
    head: resultEntry.entryHash,
    clear: ok && parsed.command === 'clear',
  };
}
