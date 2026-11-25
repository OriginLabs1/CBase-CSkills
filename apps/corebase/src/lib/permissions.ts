import { canonicalJson, type Grant, type PermissionScope } from '@oneorigin/contracts';
import { sha256Hex } from '@oneorigin/skill-kit';
import { APPROVAL_TTL_MINUTES, SHELL_VERSION } from './execution/virtual-shell';
import { appendAuditEntry, putGrant } from './storage';
import type { ApprovalRequest } from './types';

const encoder = new TextEncoder();

async function grantId(fields: Omit<Grant, 'id'>): Promise<string> {
  return sha256Hex(encoder.encode(canonicalJson(fields)));
}

/** Persists the human-approved scopes as scoped, time-bounded, revocable grants. */
export async function grantApproval(request: ApprovalRequest, subject: string): Promise<Grant[]> {
  const grantedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60_000).toISOString();
  const grants: Grant[] = [];

  for (const scope of request.scopes) {
    const fields: Omit<Grant, 'id'> = {
      subject,
      capabilityId: request.capabilityId,
      capabilityVersion: request.capabilityVersion || SHELL_VERSION,
      scope: scope as PermissionScope,
      resource: request.target,
      decision: 'allow',
      grantedAt,
      expiresAt,
      reason: `${request.reason} Approved by ${request.actor} in the UI for ${APPROVAL_TTL_MINUTES} minutes.`,
    };
    const grant: Grant = { id: await grantId(fields), ...fields };
    await putGrant(grant);
    grants.push(grant);
  }
  return grants;
}

/** Revocation is permanent for the grant and is always written to the audit chain. */
export async function revokeGrant(id: string, actor: string, grant?: Grant): Promise<Grant | undefined> {
  const target = grant;
  if (!target || target.revokedAt) return target;
  const revoked: Grant = { ...target, revokedAt: new Date().toISOString() };
  await putGrant(revoked);
  await appendAuditEntry({
    stage: 'authorization',
    actor,
    capabilityId: revoked.capabilityId,
    summary: `Grant revoked: ${revoked.scope} on ${revoked.resource}`,
    data: { grantId: id, subject: revoked.subject, scope: revoked.scope, resource: revoked.resource },
  });
  return revoked;
}

/** Creates an explicit deny record without granting anything. */
export async function denyApproval(request: ApprovalRequest, subject: string): Promise<void> {
  const fields: Omit<Grant, 'id'> = {
    subject,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion || SHELL_VERSION,
    scope: request.scope,
    resource: request.target,
    decision: 'deny',
    grantedAt: new Date().toISOString(),
    reason: `Denied by ${request.actor} in the UI.`,
  };
  await putGrant({ id: await grantId(fields), ...fields });
}
