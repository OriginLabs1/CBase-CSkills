<script lang="ts">
  import { CircleCheck, FileCode, Info, Save, SquarePen } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { skillIdentity, validateSkillMarkdown, type SkillValidation } from '@oneorigin/skill-kit';
  import { countBySeverity } from '../helpers.js';
  import { saveSkill } from '../storage.js';
  import type { ToastMessage } from '../types.js';
  import Diagnostics from './Diagnostics.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';

  interface Props {
    initialRaw: string;
    notify: (message: string, tone: ToastMessage['tone']) => void;
    ondone: (skillId: string) => void;
  }

  let { initialRaw, notify, ondone }: Props = $props();

  const TEMPLATE = `---
name: new-skill
description: Describe what this skill does and when to use it. Keep the first sentence short.
version: 0.1.0
tags: [draft]
---

# New skill

Write the instructions a human should follow. This text is advisory; it is never executed by the catalog.

## Steps

1. Describe the input you expect.
2. Describe the output you want.
3. List any assumptions or limits.
`;

  // The parent keys this component, so the initial value is intentionally a snapshot.
  let draft = $state(untrack(() => initialRaw));
  let report = $state<SkillValidation>(untrack(() => validateSkillMarkdown(initialRaw)));
  let identity = $state('');
  let saving = $state(false);

  const byteCount = $derived(new TextEncoder().encode(draft).byteLength);
  const errors = $derived(countBySeverity(report.diagnostics, 'error'));
  const warnings = $derived(countBySeverity(report.diagnostics, 'warning'));
  const notes = $derived(countBySeverity(report.diagnostics, 'info'));

  $effect(() => {
    const text = draft;
    let cancelled = false;
    const timer = setTimeout(() => {
      const next = validateSkillMarkdown(text);
      report = next;
      identity = '';
      if (next.ok && next.document) {
        skillIdentity(next.document)
          .then((value) => {
            if (!cancelled) identity = value;
          })
          .catch(() => {});
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  async function save(): Promise<void> {
    if (saving || !report.ok) return;
    saving = true;
    try {
      const result = await saveSkill(draft, { origin: 'local', label: 'Authored in CoreSkills' });
      notify(
        result.created ? 'Saved a new immutable version.' : 'That exact version already exists; the current skill was updated.',
        'good'
      );
      ondone(result.skill.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save this skill.', 'bad');
    } finally {
      saving = false;
    }
  }

  function loadTemplate(): void {
    draft = TEMPLATE;
  }
</script>

<section aria-labelledby="author-title" class="space-y-4">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400/80">Author</p>
      <h1 id="author-title" class="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">Write a SKILL.md</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-mist-200/60">
        Validation runs as you type. Saving stores an immutable, content-addressed version; earlier versions remain restorable.
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        onclick={loadTemplate}
        class="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-200 transition hover:border-accent-400/40 hover:text-mist-100"
      >
        <SquarePen size={14} aria-hidden="true" /> Starter template
      </button>
      <button
        type="button"
        onclick={save}
        disabled={saving || !report.ok || draft.trim().length === 0}
        class="inline-flex items-center gap-2 rounded-xl border border-accent-400/30 bg-accent-500/15 px-3.5 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Save size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save version'}
      </button>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
    <section class="min-w-0" aria-label="Markdown source">
      <MarkdownEditor value={draft} onchange={(value) => (draft = value)} />
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-mist-200/45">
        <span class="font-mono">{byteCount.toLocaleString()} bytes / 256 KiB limit</span>
        <span>{draft.split('\n').length} lines · Markdown instructions, not executable code</span>
      </div>
    </section>

    <div class="space-y-4">
      <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4" aria-labelledby="validation-title">
        <h2 id="validation-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
          <FileCode size={15} class="text-accent-400" aria-hidden="true" /> Live conformance
        </h2>
        <div class="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span class="rounded-full px-2 py-1 {errors > 0 ? 'bg-bad-400/15 text-bad-400' : 'bg-ink-800 text-mist-200/50'}">
            {errors} error{errors === 1 ? '' : 's'}
          </span>
          <span class="rounded-full px-2 py-1 {warnings > 0 ? 'bg-warn-400/15 text-warn-400' : 'bg-ink-800 text-mist-200/50'}">
            {warnings} warning{warnings === 1 ? '' : 's'}
          </span>
          <span class="rounded-full px-2 py-1 {notes > 0 ? 'bg-accent-400/15 text-accent-400' : 'bg-ink-800 text-mist-200/50'}">
            {notes} note{notes === 1 ? '' : 's'}
          </span>
          {#if report.ok}
            <span class="inline-flex items-center gap-1 rounded-full bg-good-400/15 px-2 py-1 text-good-400">
              <CircleCheck size={12} aria-hidden="true" /> Importable
            </span>
          {/if}
        </div>

        {#if identity}
          <div class="mt-3 rounded-xl border border-ink-700/70 bg-ink-950/70 p-3">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-mist-200/45">Identity on save</p>
            <code class="mt-1 block break-all font-mono text-[11px] leading-relaxed text-accent-400">{identity}</code>
          </div>
        {/if}
      </section>

      <Diagnostics diagnostics={report.diagnostics} title="Diagnostics" emptyMessage="Valid SKILL.md — nothing to report." />

      <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4" aria-labelledby="author-help-title">
        <h2 id="author-help-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
          <Info size={15} class="text-accent-400" aria-hidden="true" /> Frontmatter essentials
        </h2>
        <ul class="mt-3 space-y-2 text-xs leading-relaxed text-mist-200/60">
          <li>Start with <code class="font-mono text-accent-400">---</code> and close the block with another <code class="font-mono text-accent-400">---</code> line.</li>
          <li><code class="font-mono text-mist-200/80">name</code>: lowercase kebab-case, up to 64 characters.</li>
          <li><code class="font-mono text-mist-200/80">description</code>: say when to use the skill, up to 1024 characters.</li>
          <li>Optional: <code class="font-mono text-mist-200/80">version</code>, <code class="font-mono text-mist-200/80">tags</code>, <code class="font-mono text-mist-200/80">license</code>, <code class="font-mono text-mist-200/80">metadata</code>.</li>
        </ul>
      </section>
    </div>
  </div>
</section>
