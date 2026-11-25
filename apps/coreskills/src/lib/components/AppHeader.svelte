<script lang="ts">
  import { BookOpen, Code, Library, Lock, Plus, Sparkles, Upload } from '@lucide/svelte';
  import type { ViewName } from '../types.js';

  interface Props {
    view: ViewName;
    onview: (view: ViewName) => void;
    onnew: () => void;
  }

  let { view, onview, onnew }: Props = $props();
</script>

<header class="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-xl">
  <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6">
    <div class="flex items-center gap-2.5">
      <div class="grid h-9 w-9 place-items-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-400/25">
        <Sparkles size={19} aria-hidden="true" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-semibold tracking-tight text-mist-100">CoreSkills</span>
          <span class="rounded-md border border-ink-700 px-1.5 py-px font-mono text-[10px] text-mist-200/50">v0.0.1</span>
        </div>
        <p class="text-[11px] text-mist-200/45">Local capability catalog</p>
      </div>
    </div>

    <span
      class="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-mist-200/75 lg:ml-3"
      title="Guest mode: data stays on this device; no sync, collaboration or privileged execution."
    >
      <Lock size={12} aria-hidden="true" />
      Guest
    </span>

    <button
      type="button"
      onclick={onnew}
      class="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-accent-400/30 bg-accent-500/10 px-3 py-1.5 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/20"
    >
      <Plus size={15} aria-hidden="true" />
      <span class="hidden sm:inline">New skill</span>
      <span class="sm:hidden">New</span>
    </button>

    <nav aria-label="Primary" class="order-last w-full lg:order-none lg:ml-auto lg:w-auto">
      <div class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        <button
          type="button"
          onclick={() => onview('catalog')}
          aria-current={view === 'catalog' ? 'page' : undefined}
          class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition {view ===
          'catalog'
            ? 'bg-ink-800 text-mist-100 ring-1 ring-inset ring-ink-700'
            : 'text-mist-200/55 hover:bg-ink-800/60 hover:text-mist-100'}"
        >
          <Library size={15} aria-hidden="true" /> Catalog
        </button>
        <button
          type="button"
          onclick={() => onview('import')}
          aria-current={view === 'import' ? 'page' : undefined}
          class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition {view ===
          'import'
            ? 'bg-ink-800 text-mist-100 ring-1 ring-inset ring-ink-700'
            : 'text-mist-200/55 hover:bg-ink-800/60 hover:text-mist-100'}"
        >
          <Upload size={15} aria-hidden="true" /> Import
        </button>
        <button
          type="button"
          onclick={() => onview('author')}
          aria-current={view === 'author' ? 'page' : undefined}
          class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition {view ===
          'author'
            ? 'bg-ink-800 text-mist-100 ring-1 ring-inset ring-ink-700'
            : 'text-mist-200/55 hover:bg-ink-800/60 hover:text-mist-100'}"
        >
          <Code size={15} aria-hidden="true" /> Author
        </button>
        <button
          type="button"
          onclick={() => onview('about')}
          aria-current={view === 'about' ? 'page' : undefined}
          class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition {view ===
          'about'
            ? 'bg-ink-800 text-mist-100 ring-1 ring-inset ring-ink-700'
            : 'text-mist-200/55 hover:bg-ink-800/60 hover:text-mist-100'}"
        >
          <BookOpen size={15} aria-hidden="true" /> About
        </button>
      </div>
    </nav>
  </div>
</header>
