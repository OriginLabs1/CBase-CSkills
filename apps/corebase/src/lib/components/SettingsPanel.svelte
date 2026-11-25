<script lang="ts">
  import type { Grant } from '@oneorigin/contracts';
  import {
    Clock,
    HardDrive,
    KeyRound,
    RotateCcw,
    Save,
    ShieldCheck,
    Trash,
  } from '@lucide/svelte';
  import { isGrantActive } from '../helpers';
  import { STORE_NAMES } from '../storage';
  import type { AppSettings, ChainReport, Checkpoint } from '../types';

  interface Props {
    grants: Grant[];
    checkpoints: Checkpoint[];
    settings: AppSettings;
    chain: ChainReport;
    onRevoke: (id: string) => void;
    onSaveCheckpoint: (label: string) => void;
    onRestoreCheckpoint: (checkpoint: Checkpoint) => void;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
  }

  let {
    grants,
    checkpoints,
    settings,
    chain,
    onRevoke,
    onSaveCheckpoint,
    onRestoreCheckpoint,
    onUpdateSettings,
  }: Props = $props();

  let label = $state('');
  const nowMs = Date.now();

  function grantState(grant: Grant): { text: string; className: string } {
    if (grant.revokedAt) return { text: 'Revoked', className: 'text-mist-200/35' };
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= nowMs) return { text: 'Expired', className: 'text-warn-400' };
    if (!isGrantActive(grant, nowMs)) return { text: 'Denied', className: 'text-bad-400' };
    return { text: 'Active', className: 'text-good-400' };
  }

  function saveCheckpoint(): void {
    const value = label.trim();
    if (!value) return;
    onSaveCheckpoint(value);
    label = '';
  }
</script>

<div class="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
  <div class="mx-auto max-w-4xl space-y-5">
    <div>
      <h2 class="text-base font-semibold">Settings & trust</h2>
      <p class="mt-1 text-xs leading-relaxed text-mist-200/45">
        Guest mode: all data stays in this browser. No account, sync, collaboration or privileged execution is available.
      </p>
    </div>

    <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <h3 class="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={15} class="text-good-400" /> Privacy & authorization</h3>
      <div class="mt-3 space-y-3">
        <label class="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.approvalsEnabled}
            onchange={(event) => onUpdateSettings({ approvalsEnabled: event.currentTarget.checked })}
            class="mt-0.5 size-4 accent-[#38bdf8]"
          />
          <span>
            <span class="block text-xs text-mist-100">Ask before consequential actions</span>
            <span class="block text-[11px] text-mist-200/40">When off, ungranted actions are denied rather than silently allowed.</span>
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.contentTelemetry}
            onchange={(event) => onUpdateSettings({ contentTelemetry: event.currentTarget.checked })}
            class="mt-0.5 size-4 accent-[#38bdf8]"
          />
          <span>
            <span class="block text-xs text-mist-100">Content-bearing diagnostics (off by default)</span>
            <span class="block text-[11px] text-mist-200/40">No telemetry is transmitted in this browser build; this preference only records local intent.</span>
          </span>
        </label>
      </div>
      <p class="mt-3 text-[11px] text-mist-200/35">
        Audit chain: {chain.ok ? `verified across ${chain.entries} entries` : `break at #${chain.breakAt ?? '?'} — surface only`}
      </p>
    </section>

    <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="flex items-center gap-2 text-sm font-medium"><KeyRound size={15} class="text-warn-400" /> Grants</h3>
        <span class="ml-auto text-[11px] text-mist-200/35">{grants.length} stored · default deny</span>
      </div>
      {#if grants.length === 0}
        <p class="mt-3 rounded-lg border border-dashed border-ink-700 px-3 py-5 text-center text-xs text-mist-200/35">
          No grants. Consequential commands will ask for approval and grants expire after 10 minutes.
        </p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each grants as grant (grant.id)}
            {@const state = grantState(grant)}
            <li class="rounded-lg border border-ink-800 bg-ink-950/60 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class={`text-[11px] font-medium ${state.className}`}>{state.text}</span>
                <code class="text-[11px] text-mist-200/80">{grant.scope}</code>
                <span class="truncate text-[11px] text-mist-200/40">{grant.resource}</span>
                <button
                  type="button"
                  disabled={Boolean(grant.revokedAt)}
                  onclick={() => onRevoke(grant.id)}
                  class="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mist-200/60 hover:border-bad-400/40 hover:text-bad-400 disabled:opacity-30"
                >
                  <Trash size={12} /> Revoke
                </button>
              </div>
              <p class="mt-1 truncate text-[10px] text-mist-200/30">
                capability {grant.capabilityId}@{grant.capabilityVersion} · {grant.reason}
              </p>
              <p class="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-mist-200/30">
                <Clock size={10} /> granted {new Date(grant.grantedAt).toLocaleString()}
                {#if grant.expiresAt} · expires {new Date(grant.expiresAt).toLocaleString()}{/if}
              </p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <h3 class="flex items-center gap-2 text-sm font-medium"><Save size={15} class="text-accent-400" /> Checkpoints</h3>
      <p class="mt-1 text-[11px] leading-relaxed text-mist-200/40">
        Immutable snapshots of workspace files plus the audit head at capture time.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <label for="checkpoint-label" class="sr-only">Checkpoint label</label>
        <input
          id="checkpoint-label"
          bind:value={label}
          placeholder="Checkpoint label"
          class="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={!label.trim()}
          onclick={saveCheckpoint}
          class="rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-ink-950 hover:bg-accent-400 disabled:opacity-40"
        >
          Save checkpoint
        </button>
      </div>
      {#if checkpoints.length === 0}
        <p class="mt-3 text-xs text-mist-200/35">No checkpoints yet.</p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each checkpoints as checkpoint (checkpoint.id)}
            <li class="flex flex-wrap items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/60 p-3">
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 text-xs text-mist-100">
                  <span class="truncate">{checkpoint.label}</span>
                  {#if checkpoint.automatic}<span class="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] text-mist-200/40">auto</span>{/if}
                </p>
                <p class="mt-0.5 truncate font-mono text-[10px] text-mist-200/30">
                  {checkpoint.files.length} files · head {checkpoint.auditHead.slice(0, 12)} · {new Date(checkpoint.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                title="Restore this checkpoint"
                onclick={() => onRestoreCheckpoint(checkpoint)}
                class="flex shrink-0 items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mist-200/70 hover:border-accent-500/50 hover:text-accent-400"
              >
                <RotateCcw size={12} /> Restore
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <h3 class="flex items-center gap-2 text-sm font-medium"><HardDrive size={15} class="text-mist-200/60" /> Local storage</h3>
      <p class="mt-2 text-[11px] leading-relaxed text-mist-200/40">
        Database <code class="text-mist-200/70">oneorigin-corebase</code> · stores: {STORE_NAMES.join(', ')}. Stored bytes are opaque and validated on read.
      </p>
    </section>
  </div>
</div>
