<script lang="ts">
  import { canonicalJson, type AuditEntry, type AuditStage } from '@oneorigin/contracts';
  import { RefreshCw, ScrollText, ShieldAlert, ShieldCheck } from '@lucide/svelte';
  import type { ChainReport } from '../types';

  interface Props {
    entries: AuditEntry[];
    chain: ChainReport;
    onRefresh: () => void;
  }

  let { entries, chain, onRefresh }: Props = $props();

  const stageColors: Record<AuditStage, string> = {
    intent: 'bg-accent-500/10 text-accent-400',
    plan: 'bg-accent-500/10 text-accent-400',
    authorization: 'bg-warn-400/10 text-warn-400',
    execution: 'bg-ink-700/60 text-mist-200',
    verification: 'bg-good-400/10 text-good-400',
    persistence: 'bg-ink-700/60 text-mist-200',
    provenance: 'bg-good-400/10 text-good-400',
    result: 'bg-good-400/10 text-good-400',
  };

  let newestFirst = $derived([...entries].reverse());
</script>

<div class="flex h-full min-h-0 flex-col bg-ink-950">
  <div class="flex flex-wrap items-center gap-3 border-b border-ink-800 px-4 py-3">
    <div class={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${chain.ok ? 'bg-good-400/10 text-good-400' : 'bg-bad-400/10 text-bad-400'}`}>
      {#if chain.ok}<ShieldCheck size={15} />{:else}<ShieldAlert size={15} />{/if}
      <span>{chain.ok ? `Chain verified · ${chain.entries} entries` : `Chain break at entry #${chain.breakAt ?? '?'}`}</span>
    </div>
    <span class="font-mono text-[10px] text-mist-200/35">head {chain.head.slice(0, 16)}…</span>
    <button
      type="button"
      onclick={onRefresh}
      class="ml-auto flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-mist-200/70 hover:text-accent-400"
    >
      <RefreshCw size={13} /> Refresh
    </button>
  </div>

  {#if !chain.ok}
    <div class="mx-4 mt-3 rounded-lg border border-bad-400/30 bg-bad-400/5 px-3 py-2 text-xs leading-relaxed text-bad-400">
      <strong>Integrity break surfaced, not repaired.</strong> {chain.reason ?? 'The stored chain does not verify.'}
      Prior entries remain available for inspection; new entries continue from the stored tail.
    </div>
  {/if}

  <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
    {#if newestFirst.length === 0}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-center text-mist-200/35">
        <ScrollText size={26} />
        <p class="text-sm">No audit entries yet</p>
        <p class="text-xs">Run a command to record its full lifecycle.</p>
      </div>
    {:else}
      <ol class="space-y-2">
        {#each newestFirst as entry (entry.seq)}
          <li class="rounded-xl border border-ink-800 bg-ink-900/70 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-[10px] text-ink-600">#{String(entry.seq).padStart(3, '0')}</span>
              <span class={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stageColors[entry.stage]}`}>{entry.stage}</span>
              <span class="text-[10px] text-mist-200/35">{new Date(entry.at).toLocaleString()}</span>
              <span class="ml-auto text-[10px] text-mist-200/30">{entry.actor}</span>
            </div>
            <p class="mt-2 text-[13px] leading-snug text-mist-100/90">{entry.summary}</p>
            {#if entry.entryHash}
              <p class="mt-1 truncate font-mono text-[10px] text-mist-200/30">
                prev {entry.previousHash.slice(0, 12)} → hash {entry.entryHash.slice(0, 12)}
              </p>
            {/if}
            {#if entry.data && Object.keys(entry.data).length > 0}
              <details class="mt-2 group">
                <summary class="cursor-pointer list-none text-[11px] text-accent-400/70 hover:text-accent-400">Evidence</summary>
                <pre class="mt-2 max-h-56 overflow-auto rounded-lg bg-ink-950 p-2 font-mono text-[10px] leading-relaxed text-mist-200/50">{canonicalJson(entry.data)}</pre>
              </details>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</div>
