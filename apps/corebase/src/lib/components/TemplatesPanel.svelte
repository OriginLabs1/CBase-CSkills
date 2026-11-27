<script lang="ts">
  import { Check, CircleHelp, LayoutTemplate } from '@lucide/svelte';
  import { renderTextFiles, type RenderedTextFile } from '@oneorigin/client';
  import { validateTemplateInputs, type Template } from '@oneorigin/templates';

  interface Props {
    templates: Template[];
    onApply: (template: Template, values: Record<string, unknown>) => void;
  }

  let { templates, onApply }: Props = $props();

  let selectedId = $state<string | null>(null);
  let values = $state<Record<string, unknown>>({});
  let preview = $state<RenderedTextFile[]>([]);
  let error = $state('');
  let applying = $state(false);

  const selected = $derived(templates.find((template) => template.id === selectedId) ?? null);

  function choose(template: Template): void {
    selectedId = template.id;
    values = Object.fromEntries((template.inputs ?? []).map((input) => [input.name, input.default ?? '']));
    error = '';
    void refreshPreview();
  }

  async function refreshPreview(): Promise<void> {
    if (!selected) return;
    const report = validateTemplateInputs(selected, values);
    if (!report.ok) {
      error = report.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Invalid inputs.';
      preview = [];
      return;
    }
    error = '';
    try {
      preview = await renderTextFiles(selected, values);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not render this template.';
      preview = [];
    }
  }

  async function apply(): Promise<void> {
    if (!selected || applying) return;
    const report = validateTemplateInputs(selected, values);
    if (!report.ok) {
      error = report.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Invalid inputs.';
      return;
    }
    applying = true;
    try {
      onApply(selected, { ...values });
    } finally {
      applying = false;
    }
  }
</script>

<div class="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
  <div class="mx-auto max-w-5xl space-y-5">
    <div>
      <h2 class="text-base font-semibold">Templates</h2>
      <p class="mt-1 text-xs leading-relaxed text-mist-200/45">
        Starting points, not frameworks. Applying one creates a local project; every file is audited and remains editable. Nothing leaves this device unless you choose the optional service.
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <section aria-label="Available templates" class="space-y-2">
        {#each templates as template (template.id)}
          <button
            type="button"
            onclick={() => choose(template)}
            class={`w-full rounded-xl border p-3 text-left transition ${selectedId === template.id ? 'border-accent-400/50 bg-accent-500/10' : 'border-ink-800 bg-ink-900/60 hover:border-ink-700'}`}
          >
            <span class="flex items-center gap-2 text-xs font-medium text-mist-100">
              <LayoutTemplate size={14} class="text-accent-400" /> {template.name}
            </span>
            <span class="mt-1 block text-[11px] leading-relaxed text-mist-200/50">{template.summary}</span>
            <span class="mt-1.5 block font-mono text-[10px] text-mist-200/30">
              {template.kind} · v{template.version} · {template.files.length} file(s)
            </span>
          </button>
        {/each}
        {#if templates.length === 0}
          <p class="rounded-xl border border-dashed border-ink-700 p-4 text-xs text-mist-200/40">No templates available.</p>
        {/if}
      </section>

      <section aria-label="Template details" class="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        {#if !selected}
          <p class="text-xs text-mist-200/45">Select a template to preview its inputs and files.</p>
        {:else}
          <h3 class="text-sm font-medium text-mist-100">{selected.name}</h3>
          {#if selected.description}<p class="mt-1 text-[11px] text-mist-200/50">{selected.description}</p>{/if}

          <div class="mt-4 space-y-3">
            {#each selected.inputs ?? [] as input (input.name)}
              <label class="block">
                <span class="block text-[11px] text-mist-200/65">
                  {input.name}{input.required !== false ? ' *' : ''}
                </span>
                {#if input.description}<span class="block text-[10px] text-mist-200/35">{input.description}</span>{/if}
                {#if input.type === 'number'}
                  <input
                    type="number"
                    value={String(values[input.name] ?? input.default ?? '')}
                    oninput={(event) => {
                      values = { ...values, [input.name]: Number(event.currentTarget.value) };
                      void refreshPreview();
                    }}
                    class="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs focus:border-accent-500 focus:outline-none"
                  />
                {:else}
                  <input
                    type="text"
                    value={String(values[input.name] ?? '')}
                    oninput={(event) => {
                      values = { ...values, [input.name]: event.currentTarget.value };
                      void refreshPreview();
                    }}
                    placeholder={input.name}
                    class="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
                  />
                {/if}
              </label>
            {/each}
          </div>

          {#if error}
            <p class="mt-3 rounded-lg border border-bad-400/30 bg-bad-400/5 p-2 text-[11px] text-bad-400">{error}</p>
          {/if}

          {#if preview.length > 0}
            <div class="mt-4 space-y-2">
              <p class="text-[11px] font-medium text-mist-200/65">Preview</p>
              {#each preview.slice(0, 2) as file (file.path)}
                <div class="rounded-lg border border-ink-800 bg-ink-950/60 p-3">
                  <p class="font-mono text-[10px] text-accent-400">{file.path}</p>
                  <pre class="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-mist-200/60">{file.content.slice(0, 1200)}</pre>
                </div>
              {/each}
            </div>
          {/if}

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={applying || Boolean(error)}
              onclick={() => void apply()}
              class="rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-ink-950 hover:bg-accent-400 disabled:opacity-40"
            >
              Apply as a local project
            </button>
            <span class="flex items-center gap-1 text-[10px] text-mist-200/35">
              <Check size={11} /> Hashes verified before apply
            </span>
          </div>

          {#if selected.derivedFrom?.length}
            <p class="mt-3 flex items-start gap-1.5 text-[10px] text-mist-200/35">
              <CircleHelp size={11} class="mt-0.5 shrink-0" />
              Derived from {selected.derivedFrom.length} source template(s); provenance is preserved.
            </p>
          {/if}
        {/if}
      </section>
    </div>
  </div>
</div>
