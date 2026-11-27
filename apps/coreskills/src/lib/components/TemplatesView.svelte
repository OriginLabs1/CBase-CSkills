<script lang="ts">
  import { CircleCheck, Info, LayoutTemplate, ShieldAlert } from '@lucide/svelte';
  import { renderSkillTemplate } from '@oneorigin/client';
  import { validateTemplateInputs, type Template } from '@oneorigin/templates';

  interface Props {
    templates: Template[];
    onUse: (template: Template, markdown: string) => void;
  }

  let { templates, onUse }: Props = $props();

  let selectedId = $state<string | null>(null);
  let values = $state<Record<string, unknown>>({});
  let markdown = $state('');
  let error = $state('');

  const selected = $derived(templates.find((template) => template.id === selectedId) ?? null);

  function choose(template: Template): void {
    selectedId = template.id;
    values = Object.fromEntries((template.inputs ?? []).map((input) => [input.name, input.default ?? '']));
    error = '';
    void preview();
  }

  async function preview(): Promise<void> {
    if (!selected) return;
    const report = validateTemplateInputs(selected, values);
    if (!report.ok) {
      error = report.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Invalid inputs.';
      markdown = '';
      return;
    }
    error = '';
    try {
      markdown = await renderSkillTemplate(selected, values);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not render this template.';
      markdown = '';
    }
  }

  function use(): void {
    if (!selected || !markdown || error) return;
    onUse(selected, markdown);
  }
</script>

<section aria-labelledby="templates-title" class="space-y-4">
  <div>
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400/80">Shared templates</p>
    <h1 id="templates-title" class="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">Start from a good example</h1>
    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-mist-200/60">
      Templates are portable starting points, not frameworks. File hashes are checked before rendering; the result opens in the editor so you can review it before saving.
    </p>
  </div>

  <div class="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
    <div class="space-y-2" aria-label="Available templates">
      {#each templates as template (template.id)}
        <button
          type="button"
          onclick={() => choose(template)}
          class={`w-full rounded-2xl border p-3.5 text-left transition ${selectedId === template.id ? 'border-accent-400/50 bg-accent-500/10' : 'border-ink-700/70 bg-ink-900/60 hover:border-ink-600'}`}
        >
          <span class="flex items-center gap-2 text-xs font-semibold text-mist-100">
            <LayoutTemplate size={14} class="text-accent-400" /> {template.name}
          </span>
          <span class="mt-1 block text-[11px] leading-relaxed text-mist-200/55">{template.summary}</span>
          <span class="mt-1.5 block font-mono text-[10px] text-mist-200/35">
            {template.kind} · v{template.version}
          </span>
        </button>
      {/each}
      {#if templates.length === 0}
        <p class="rounded-2xl border border-dashed border-ink-700 p-4 text-xs text-mist-200/45">No templates available.</p>
      {/if}
    </div>

    <div class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5">
      {#if !selected}
        <p class="text-xs text-mist-200/50">Select a template to fill in its inputs and preview the SKILL.md.</p>
      {:else}
        <h2 class="text-sm font-semibold text-mist-100">{selected.name}</h2>
        {#if selected.description}<p class="mt-1 text-[11px] leading-relaxed text-mist-200/50">{selected.description}</p>{/if}

        <div class="mt-4 space-y-3">
          {#each selected.inputs ?? [] as input (input.name)}
            <label class="block">
              <span class="text-[11px] text-mist-200/65">{input.name}{input.required !== false ? ' *' : ''}</span>
              {#if input.description}<span class="block text-[10px] text-mist-200/35">{input.description}</span>{/if}
              <input
                type="text"
                value={String(values[input.name] ?? '')}
                oninput={(event) => {
                  values = { ...values, [input.name]: event.currentTarget.value };
                  void preview();
                }}
                class="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-xs placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
              />
            </label>
          {/each}
        </div>

        {#if error}
          <p class="mt-3 rounded-xl border border-bad-400/30 bg-bad-400/5 p-2 text-[11px] text-bad-400">{error}</p>
        {/if}

        {#if markdown}
          <div class="mt-4">
            <p class="flex items-center gap-1.5 text-[11px] text-mist-200/65"><CircleCheck size={12} class="text-good-400" /> Rendered SKILL.md</p>
            <pre class="mt-2 max-h-72 overflow-auto rounded-xl border border-ink-700/70 bg-ink-950/70 p-3 font-mono text-[10px] leading-relaxed text-mist-200/65">{markdown.slice(0, 2400)}</pre>
          </div>
        {/if}

        <button
          type="button"
          disabled={!markdown || Boolean(error)}
          onclick={use}
          class="mt-4 rounded-xl border border-accent-400/30 bg-accent-500/15 px-3.5 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/25 disabled:opacity-40"
        >
          Open in editor
        </button>
      {/if}
    </div>
  </div>

  <div class="flex items-start gap-2 rounded-2xl border border-warn-400/25 bg-warn-400/5 p-3 text-[11px] leading-relaxed text-warn-400">
    <ShieldAlert size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
    <span>A checksum proves the bytes match a known version. It says nothing about intent, quality or safety. Read every instruction and permission request yourself.</span>
  </div>
  <p class="flex items-center gap-1.5 text-[10px] text-mist-200/35"><Info size={11} aria-hidden="true" /> Applying a template opens the editor; nothing is saved until you choose “Save version”.</p>
</section>
