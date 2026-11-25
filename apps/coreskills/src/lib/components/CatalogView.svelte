<script lang="ts">
  import type { CapabilityKind } from '@oneorigin/contracts';
  import { Download, LayoutGrid, List, PackageOpen, Search, SlidersHorizontal, Upload, X } from '@lucide/svelte';
  import { CAPABILITY_KINDS, filterSkills, sortSkills, tagFacets } from '../helpers.js';
  import type { LayoutKey, SkillRecord, SortKey } from '../types.js';
  import SkillCard from './SkillCard.svelte';

  interface Props {
    skills: SkillRecord[];
    selectedId: string | null;
    exporting: boolean;
    onselect: (id: string) => void;
    onimport: () => void;
    onexportall: () => void;
  }

  let { skills, selectedId, exporting, onselect, onimport, onexportall }: Props = $props();

  let query = $state('');
  let activeTags = $state<string[]>([]);
  let kind = $state<CapabilityKind | 'all'>('all');
  let sort = $state<SortKey>('updated');
  let layout = $state<LayoutKey>('grid');

  const facets = $derived(tagFacets(skills));
  const visible = $derived(sortSkills(filterSkills(skills, { query, tags: activeTags, kind }), sort));

  function toggleTag(tag: string): void {
    activeTags = activeTags.includes(tag) ? activeTags.filter((item) => item !== tag) : [...activeTags, tag];
  }

  function clearFilters(): void {
    query = '';
    activeTags = [];
    kind = 'all';
  }
</script>

<section aria-labelledby="catalog-title">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400/80">Catalog</p>
      <h1 id="catalog-title" class="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
        Your skills, on this device
      </h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-mist-200/60">
        Browse SKILL.md capabilities, inspect their exact bytes and permission requests, and keep every version restorable.
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        onclick={onimport}
        class="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-100 transition hover:border-accent-400/40 hover:bg-ink-800"
      >
        <Upload size={15} aria-hidden="true" /> Import SKILL.md
      </button>
      <button
        type="button"
        onclick={onexportall}
        disabled={exporting || skills.length === 0}
        class="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-100 transition hover:border-accent-400/40 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={15} aria-hidden="true" /> {exporting ? 'Building…' : 'Export bundle'}
      </button>
    </div>
  </div>

  <div class="mt-6 rounded-2xl border border-ink-700/70 bg-ink-900/60 p-3 sm:p-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="relative flex-1">
        <label for="catalog-search" class="sr-only">Search skills by name, description or tag</label>
        <Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-200/40" aria-hidden="true" />
        <input
          id="catalog-search"
          type="search"
          bind:value={query}
          placeholder="Search name, description, tags…"
          class="w-full rounded-xl border border-ink-700 bg-ink-950/70 py-2.5 pl-9 pr-3 text-sm text-mist-100 placeholder:text-mist-200/30 focus:border-accent-400/50 focus:outline-none"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-200/45">
          <SlidersHorizontal size={14} aria-hidden="true" /> Filters
        </div>
        <label for="catalog-kind" class="sr-only">Filter by capability kind</label>
        <select
          id="catalog-kind"
          bind:value={kind}
          class="rounded-xl border border-ink-700 bg-ink-950/70 px-2.5 py-2 text-xs text-mist-200 focus:border-accent-400/50 focus:outline-none"
        >
          <option value="all">All kinds</option>
          {#each CAPABILITY_KINDS as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
        <label for="catalog-sort" class="sr-only">Sort skills</label>
        <select
          id="catalog-sort"
          bind:value={sort}
          class="rounded-xl border border-ink-700 bg-ink-950/70 px-2.5 py-2 text-xs text-mist-200 focus:border-accent-400/50 focus:outline-none"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
        <div class="flex items-center rounded-xl border border-ink-700 bg-ink-950/70 p-0.5" role="group" aria-label="Layout">
          <button
            type="button"
            onclick={() => (layout = 'grid')}
            aria-label="Grid layout"
            aria-pressed={layout === 'grid'}
            class="rounded-lg p-1.5 transition {layout === 'grid' ? 'bg-ink-700 text-accent-400' : 'text-mist-200/45 hover:text-mist-100'}"
          >
            <LayoutGrid size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onclick={() => (layout = 'list')}
            aria-label="List layout"
            aria-pressed={layout === 'list'}
            class="rounded-lg p-1.5 transition {layout === 'list' ? 'bg-ink-700 text-accent-400' : 'text-mist-200/45 hover:text-mist-100'}"
          >
            <List size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    {#if facets.length > 0}
      <div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-800/70 pt-3">
        <span class="mr-1 text-[11px] font-semibold uppercase tracking-wide text-mist-200/40">Tags</span>
        {#each facets as facet (facet.tag)}
          <button
            type="button"
            onclick={() => toggleTag(facet.tag)}
            aria-pressed={activeTags.includes(facet.tag)}
            class="rounded-full border px-2.5 py-1 text-[11px] transition {activeTags.includes(facet.tag)
              ? 'border-accent-400/50 bg-accent-500/15 text-accent-400'
              : 'border-ink-700 bg-ink-850/70 text-mist-200/60 hover:border-ink-600 hover:text-mist-100'}"
          >
            #{facet.tag} <span class="opacity-50">{facet.count}</span>
          </button>
        {/each}
        {#if query || activeTags.length > 0 || kind !== 'all'}
          <button
            type="button"
            onclick={clearFilters}
            class="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-mist-200/50 transition hover:text-bad-400"
          >
            <X size={12} aria-hidden="true" /> Clear
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <div class="mt-4 flex items-center justify-between text-xs text-mist-200/45">
    <span>
      Showing <span class="font-semibold text-mist-200/80">{visible.length}</span> of {skills.length} skill{skills.length === 1 ? '' : 's'}
    </span>
    <span class="hidden sm:inline">Checksums verify bytes, not safety</span>
  </div>

  {#if visible.length === 0}
    <div class="mt-4 grid place-items-center rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-16 text-center">
      <div class="max-w-sm">
        <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-800 text-mist-200/50">
          <PackageOpen size={22} aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-base font-semibold text-mist-100">No skills match this view</h2>
        <p class="mt-2 text-sm leading-relaxed text-mist-200/55">
          {#if skills.length === 0}
            Import a SKILL.md file, paste instructions, or author a new skill to begin.
          {:else}
            Try a different search term, or clear the active tag and kind filters.
          {/if}
        </p>
        <div class="mt-5 flex justify-center gap-2">
          {#if skills.length > 0}
            <button
              type="button"
              onclick={clearFilters}
              class="rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-100 hover:border-accent-400/40"
            >
              Clear filters
            </button>
          {/if}
          <button
            type="button"
            onclick={onimport}
            class="rounded-xl border border-accent-400/30 bg-accent-500/10 px-3.5 py-2 text-xs font-semibold text-accent-400 hover:bg-accent-500/20"
          >
            Import a skill
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="mt-4 {layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-3'}">
      {#each visible as skill (skill.id)}
        <SkillCard {skill} selected={selectedId === skill.id} onselect={onselect} />
      {/each}
    </div>
  {/if}
</section>
