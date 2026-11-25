<script lang="ts">
  import type { Diagnostic } from '@oneorigin/contracts';
  import { CircleCheck, Info } from '@lucide/svelte';
  import SeverityChip from './SeverityChip.svelte';

  interface Props {
    diagnostics: Diagnostic[];
    title?: string;
    emptyMessage?: string;
  }

  let { diagnostics, title = 'Diagnostics', emptyMessage = 'No diagnostics.' }: Props = $props();
</script>

<section class="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4 sm:p-5" aria-label={title}>
  <div class="mb-3 flex items-center justify-between gap-3">
    <h3 class="text-sm font-semibold text-mist-100">{title}</h3>
    <span class="rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-mist-200/70">
      {diagnostics.length} result{diagnostics.length === 1 ? '' : 's'}
    </span>
  </div>

  {#if diagnostics.length === 0}
    <div class="flex items-center gap-2 rounded-xl border border-good-400/20 bg-good-400/5 px-3 py-3 text-sm text-good-400">
      <CircleCheck size={16} aria-hidden="true" />
      <span>{emptyMessage}</span>
    </div>
  {:else}
    <ul class="space-y-2">
      {#each diagnostics as diagnostic, index (index)}
        <li class="rounded-xl border border-ink-700/60 bg-ink-850/80 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <SeverityChip severity={diagnostic.severity} />
            <span class="font-mono text-xs font-semibold text-mist-100">{diagnostic.code}</span>
            <code class="font-mono text-[11px] text-mist-200/50">{diagnostic.path}</code>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-mist-200/85">{diagnostic.message}</p>
        </li>
      {/each}
    </ul>
  {/if}

  {#if diagnostics.length > 0}
    <p class="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-mist-200/50">
      <Info size={13} class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>Errors block import. Warnings and notes are informational and can be reviewed by a human.</span>
    </p>
  {/if}
</section>
