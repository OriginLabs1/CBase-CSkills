<script lang="ts">
  import { onMount } from 'svelte';
  import { Ban, Clock, ShieldAlert, ShieldCheck } from '@lucide/svelte';
  import type { ApprovalRequest } from '../types';

  interface Props {
    request: ApprovalRequest;
    onApprove: () => void;
    onDeny: () => void;
  }

  let { request, onApprove, onDeny }: Props = $props();
  let denyButton = $state<HTMLButtonElement | undefined>();

  onMount(() => denyButton?.focus());
</script>

<div class="fixed inset-0 z-50 grid place-items-center p-4">
  <div class="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" aria-hidden="true"></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="approval-title"
    class="relative w-full max-w-lg rounded-2xl border border-warn-400/25 bg-ink-900 p-5 shadow-2xl shadow-black/50"
  >
    <div class="flex items-start gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-400/10 text-warn-400"><ShieldAlert size={19} /></span>
      <div>
        <h2 id="approval-title" class="text-base font-semibold">Approval required</h2>
        <p class="mt-1 text-xs leading-relaxed text-mist-200/50">
          A consequential action is about to run. Nothing has been executed yet.
        </p>
      </div>
    </div>

    <dl class="mt-4 space-y-2 rounded-xl border border-ink-800 bg-ink-950/70 p-3 text-xs">
      <div class="flex flex-wrap gap-2">
        <dt class="w-24 shrink-0 text-mist-200/35">Capability</dt>
        <dd class="min-w-0 break-all font-mono text-mist-100/85">{request.capabilityId}@{request.capabilityVersion}</dd>
      </div>
      <div class="flex flex-wrap gap-2">
        <dt class="w-24 shrink-0 text-mist-200/35">Adapter</dt>
        <dd class="font-mono text-mist-100/85">{request.adapterId}</dd>
      </div>
      <div class="flex flex-wrap gap-2">
        <dt class="w-24 shrink-0 text-mist-200/35">Scope</dt>
        <dd class="flex flex-wrap gap-1">
          {#each request.scopes as scope (scope)}
            <code class="rounded bg-warn-400/10 px-1.5 py-0.5 text-warn-400">{scope}</code>
          {/each}
        </dd>
      </div>
      <div class="flex flex-wrap gap-2">
        <dt class="w-24 shrink-0 text-mist-200/35">Exact target</dt>
        <dd class="min-w-0 break-all font-mono text-accent-400">{request.target}</dd>
      </div>
      <div class="flex flex-wrap gap-2">
        <dt class="w-24 shrink-0 text-mist-200/35">Reason</dt>
        <dd class="min-w-0 flex-1 leading-relaxed text-mist-200/75">{request.reason}</dd>
      </div>
    </dl>

    <p class="mt-3 flex items-center gap-1.5 text-[11px] text-mist-200/35">
      <Clock size={12} /> Approval creates a revocable grant for {request.expiresInMinutes} minutes. Revoke it any time in Settings.
    </p>

    <div class="mt-5 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        bind:this={denyButton}
        onclick={onDeny}
        class="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-xs text-mist-200/70 hover:text-bad-400"
      >
        <Ban size={14} /> Deny
      </button>
      <button
        type="button"
        onclick={onApprove}
        class="flex items-center gap-1.5 rounded-lg bg-good-400 px-3 py-2 text-xs font-medium text-ink-950 hover:bg-good-400/85"
      >
        <ShieldCheck size={14} /> Approve for {request.expiresInMinutes} minutes
      </button>
    </div>
  </div>
</div>
