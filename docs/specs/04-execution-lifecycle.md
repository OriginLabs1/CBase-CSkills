# 04 — Execution Lifecycle (v0.0.1)

All execution in CoreBase, and any capability invocation in CoreSkills that has effects, follows one lifecycle:

```
Intent → Plan → Authorization → Execute → Verify → Persist → Provenance → Result
```

## Stages

| Stage | Record | Requirement |
| --- | --- | --- |
| Intent | `intent` | Natural-language or structured goal, actor, timestamp. |
| Plan | `plan` | Concrete steps and required scopes/targets. MUST be inspectable before execution for consequential actions. |
| Authorization | `authorization` | Grants checked or approval obtained; denials stop the lifecycle. |
| Execute | `execution` | Adapter name, input hash, output hash, duration, exit status. |
| Verify | `verification` | Explicit checks with pass/fail; execution is not "successful" until verified. |
| Persist | `persistence` | State changes applied with a checkpoint reference. |
| Provenance | `provenance` | Hash-chained audit entry linking all prior stages. |
| Result | `result` | User-visible outcome with links to the verification and audit records. |

## Adapters

Execution is always through an explicit adapter. The adapter contract is:

```ts
interface ExecutionAdapter {
  id: string;                            // e.g. "virtual-shell", "remote-http", "native-bridge"
  requiredScopes: PermissionScope[];
  describe(): AdapterDescription;
  plan(input: ExecutionInput): Promise<ExecutionPlan>;
  execute(plan: ExecutionPlan, ctx: ExecutionContext): Promise<ExecutionOutput>;
  verify(plan: ExecutionPlan, output: ExecutionOutput): Promise<VerificationReport>;
}
```

- A browser build MUST default to a sandboxed adapter with a bounded command set and no arbitrary process spawning.
- Remote and native adapters MUST be explicitly configured by the user and MUST NOT be silently substituted.
- Each adapter MUST declare its required scopes; the authorization stage MUST enforce them.

## Verification

`verification` contains named checks (e.g. `exitCodeZero`, `expectedFilesPresent`, `checksumMatches`) with `passed`, `detail` and optional `evidence`. A failed check MUST produce a failed result even if execution returned output.

## Provenance chain

Audit entries are hash-chained:

```
entryHash = sha256(canonical(entry without entryHash) + previousEntryHash)
```

Genesis `previousEntryHash` is 64 zero characters. The chain MUST be verified on load and a break MUST be surfaced to the user, not silently repaired.

## Checkpoints and recovery

A checkpoint captures workspace state plus the audit head at a point in time. Resuming a session restores the checkpoint and continues the chain from its recorded head. Checkpoints MUST be immutable and addressable by hash.
