<script lang="ts">
  import { ChevronRight, Clock, Shield } from '@lucide/svelte';
  import { formatDate, shortHash } from '../helpers.js';
  import type { SkillRecord } from '../types.js';

  interface Props {
    skill: SkillRecord;
    selected: boolean;
    onselect: (id: string) => void;
  }

  let { skill, selected, onselect }: Props = $props();
</script>

<button
  type="button"
  onclick={() => onselect(skill.id)}
  aria-pressed={selected}
  aria-label={`Open ${skill.name}`}
  class="group flex h-full w-full flex-col rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent-400/50 hover:bg-ink-800/90 focus-visible:border-accent-400 {selected
    ? 'border-accent-400/60 bg-accent-500/10 shadow-[0_0_0_1px_rgba(125,211,252,0.18)]'
    : 'border-ink-700/70 bg-ink-900/80'}"
>
  <div class="flex w-full items-start justify-between gap-3">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate text-[15px] font-semibold tracking-tight text-mist-100">{skill.name}</h3>
        <span class="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mist-200/60">v{skill.version}</span>
      </div>
      <p class="mt-0.5 truncate font-mono text-[11px] text-mist-200/40">{skill.id}</p>
    </div>
    <ChevronRight
      size={17}
      class="mt-1 shrink-0 text-mist-200/30 transition group-hover:translate-x-0.5 group-hover:text-accent-400"
      aria-hidden="true"
    />
  </div>

  <p class="mt-3 line-clamp-2 text-sm leading-relaxed text-mist-200/70">{skill.description}</p>

  {#if skill.tags.length > 0}
    <div class="mt-3 flex flex-wrap gap-1.5">
      {#each skill.tags.slice(0, 4) as tag (tag)}
        <span class="rounded-full bg-ink-800/90 px-2 py-0.5 text-[11px] text-mist-200/60">#{tag}</span>
      {/each}
    </div>
  {/if}

  <div class="mt-4 flex w-full items-center gap-3 border-t border-ink-700/50 pt-3 text-[11px] text-mist-200/45">
    <span class="inline-flex items-center gap-1">
      <Shield size={12} aria-hidden="true" />
      {skill.origin === 'local' ? 'Created here' : 'Imported'}
    </span>
    <span class="inline-flex items-center gap-1">
      <Clock size={12} aria-hidden="true" />
      {formatDate(skill.updatedAt)}
    </span>
    <code class="ml-auto font-mono" title={skill.identity}>{shortHash(skill.identity)}</code>
  </div>
</button>
