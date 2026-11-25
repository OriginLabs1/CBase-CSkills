<script lang="ts">
  import { Command, Menu, ShieldAlert, ShieldCheck, UserRound } from '@lucide/svelte';
  import type { ChainReport, TabId } from '../types';

  interface Props {
    projectName: string;
    tab: TabId;
    status: string;
    chain: ChainReport;
    adapterName: string;
    onMenu: () => void;
  }

  let { projectName, tab, status, chain, adapterName, onMenu }: Props = $props();

  const titles: Record<TabId, string> = {
    editor: 'Editor',
    terminal: 'Terminal',
    audit: 'Audit',
    agents: 'Agents',
    settings: 'Settings',
  };
</script>

<header class="flex h-14 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-900/95 px-3 sm:px-5">
  <button
    type="button"
    aria-label="Open navigation"
    onclick={onMenu}
    class="rounded-lg p-2 text-mist-200 hover:bg-ink-800 lg:hidden"
  >
    <Menu size={18} />
  </button>

  <div class="flex min-w-0 items-center gap-2.5">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-400">
      <Command size={17} />
    </span>
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold tracking-tight">CoreBase <span class="text-ink-600">/ {titles[tab]}</span></p>
      <p class="truncate text-[11px] text-mist-200/50">{projectName || 'No project'}</p>
    </div>
  </div>

  <div class="ml-auto flex items-center gap-2">
    <span class="hidden items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] text-mist-200/70 sm:flex">
      <span class="size-1.5 rounded-full bg-good-400"></span>
      {adapterName} · sandboxed
    </span>
    <span class="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] text-mist-200/80">
      <UserRound size={12} /> Guest
    </span>
    <span
      aria-live="polite"
      class="hidden items-center gap-1.5 rounded-full border border-ink-700 px-2.5 py-1 text-[11px] text-mist-200/80 md:flex"
    >
      <span class="size-1.5 rounded-full bg-accent-400"></span>{status}
    </span>
    <span
      class={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${chain.ok ? 'bg-good-400/10 text-good-400' : 'bg-bad-400/10 text-bad-400'}`}
      title={chain.reason ?? `${chain.entries} hash-chained audit entries`}
    >
      {#if chain.ok}<ShieldCheck size={13} />{:else}<ShieldAlert size={13} />{/if}
      <span class="hidden sm:inline">{chain.ok ? 'Chain verified' : `Break at #${chain.breakAt ?? '?'}`}</span>
    </span>
  </div>
</header>
