<script lang="ts">
  import { Bot, CircleCheck, CircleX, Sparkles } from '@lucide/svelte';
  import type { ModelAdapterDescription, StructuredPlan } from '../agents';

  interface Props {
    adapters: ModelAdapterDescription[];
    activeId: string;
    goal: string;
    plan: StructuredPlan | null;
    error: string;
    onGoalChange: (value: string) => void;
    onSelect: (id: string) => void;
    onGenerate: () => void;
  }

  let { adapters, activeId, goal, plan, error, onGoalChange, onSelect, onGenerate }: Props = $props();
</script>

<div class="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
  <div class="mx-auto max-w-3xl space-y-5">
    <div>
      <h2 class="text-base font-semibold">Agent & model adapters</h2>
      <p class="mt-1 text-xs leading-relaxed text-mist-200/45">
        Model adapters only plan. Execution always goes through the explicit sandboxed shell adapter. No API keys or endpoints are stored in this browser build.
      </p>
    </div>

    <section class="grid gap-3 sm:grid-cols-2">
      {#each adapters as adapter (adapter.id)}
        <article class={`rounded-xl border p-4 ${adapter.configured ? 'border-good-400/20 bg-good-400/5' : 'border-ink-700/60 bg-ink-900/60'}`}>
          <div class="flex items-start gap-3">
            <span class={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${adapter.configured ? 'bg-good-400/10 text-good-400' : 'bg-ink-800 text-mist-200/35'}`}>
              <Bot size={17} />
            </span>
            <div class="min-w-0">
              <h3 class="truncate text-sm font-medium">{adapter.name}</h3>
              <p class="mt-0.5 flex items-center gap-1 text-[11px]">
                {#if adapter.configured}<CircleCheck size={12} class="text-good-400" /> Ready{:else}<CircleX size={12} class="text-bad-400" /> Disabled{/if}
              </p>
            </div>
          </div>
          <p class="mt-3 text-xs leading-relaxed text-mist-200/50">{adapter.limitations}</p>
          <div class="mt-3 flex items-center justify-between gap-2">
            <code class="truncate text-[10px] text-mist-200/30">{adapter.id}</code>
            <button
              type="button"
              disabled={!adapter.configured || adapter.id === activeId}
              onclick={() => onSelect(adapter.id)}
              class="shrink-0 rounded-lg border border-ink-700 px-2.5 py-1 text-[11px] text-mist-200/70 hover:border-accent-500/50 hover:text-accent-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {adapter.id === activeId ? 'Selected' : adapter.configured ? 'Select' : 'Not configured'}
            </button>
          </div>
        </article>
      {/each}
    </section>

    <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <h3 class="flex items-center gap-2 text-sm font-medium"><Sparkles size={15} class="text-accent-400" /> Generate a local plan</h3>
      <label for="agent-goal" class="mt-3 block text-[11px] uppercase tracking-wider text-mist-200/40">Intent</label>
      <textarea
        id="agent-goal"
        value={goal}
        oninput={(event) => onGoalChange(event.currentTarget.value)}
        rows={3}
        placeholder="e.g. Draft documentation for the welcome workspace"
        class="mt-1.5 w-full resize-y rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
      ></textarea>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onclick={onGenerate}
          disabled={goal.trim().length === 0}
          class="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-accent-400 disabled:opacity-40"
        >
          Generate plan offline
        </button>
        <span class="text-[11px] text-mist-200/35">Deterministic · no network · no keys</span>
      </div>
      {#if error}
        <p class="mt-3 rounded-lg bg-bad-400/10 px-3 py-2 text-xs text-bad-400">{error}</p>
      {/if}
    </section>

    {#if plan}
      <section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium">Structured plan</h3>
          <code class="text-[10px] text-mist-200/30">{plan.adapterId}</code>
        </div>
        <p class="mt-2 text-xs text-mist-200/60">{plan.summary}</p>
        <ol class="mt-3 space-y-1.5">
          {#each plan.steps as step, index (index)}
            <li class="flex gap-2 text-xs text-mist-200/70">
              <span class="font-mono text-accent-400/60">{index + 1}.</span><span>{step}</span>
            </li>
          {/each}
        </ol>
        <ul class="mt-3 space-y-1 border-t border-ink-800 pt-3 text-[11px] text-mist-200/40">
          {#each plan.notes as note (note)}
            <li>· {note}</li>
          {/each}
        </ul>
        <p class="mt-3 text-[11px] text-mist-200/30">
          Required scopes: {plan.requiredScopes.length ? plan.requiredScopes.join(', ') : 'none — planning only'}
        </p>
      </section>
    {:else}
      <div class="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-xs text-mist-200/35">
        No plan generated yet. The offline adapter will show its inspectable steps here.
      </div>
    {/if}
  </div>
</div>
