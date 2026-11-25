<script lang="ts">
  import type { Diagnostic } from '@oneorigin/contracts';
  import { Check, FileText, FileUp, Package, RotateCcw, Upload, X } from '@lucide/svelte';
  import { skillIdentity, validateSkillMarkdown } from '@oneorigin/skill-kit';
  import { planBundleImport, type BundlePlan } from '../bundle.js';
  import { countBySeverity, importDecision, importableCandidates, shortHash } from '../helpers.js';
  import { putBundleRecords, saveSkill } from '../storage.js';
  import type { ImportCandidate, ToastMessage } from '../types.js';
  import Diagnostics from './Diagnostics.svelte';
  import SeverityChip from './SeverityChip.svelte';

  interface Props {
    notify: (message: string, tone: ToastMessage['tone']) => void;
    onimported: () => void;
  }

  let { notify, onimported }: Props = $props();

  let candidates = $state<ImportCandidate[]>([]);
  let pasteText = $state('');
  let busy = $state(false);
  let bundlePlan = $state<BundlePlan | null>(null);
  let bundleName = $state('');
  let bundleDiagnostics = $state<Diagnostic[]>([]);

  let sequence = 0;

  function messageFrom(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error.';
  }

  async function addCandidate(filename: string, raw: string): Promise<void> {
    const validation = validateSkillMarkdown(raw);
    const identity = validation.document ? await skillIdentity(validation.document) : undefined;
    const key = `candidate-${++sequence}`;
    candidates = [
      ...candidates,
      {
        key,
        filename,
        raw,
        validation,
        identity,
        included: validation.ok
      }
    ];
  }

  async function handleSkillFiles(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(
      (file) => file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown')
    );
    input.value = '';
    for (const file of files) await addCandidate(file.name, await file.text());
    if (files.length === 0 && input.files?.length) notify('Only .md or .markdown files can be imported.', 'bad');
  }

  async function addPasted(): Promise<void> {
    if (pasteText.trim().length === 0) return;
    await addCandidate('pasted-skill.md', pasteText);
    pasteText = '';
  }

  function removeCandidate(key: string): void {
    candidates = candidates.filter((candidate) => candidate.key !== key);
  }

  function toggleCandidate(key: string): void {
    candidates = candidates.map((candidate) =>
      candidate.key === key ? { ...candidate, included: !candidate.included } : candidate
    );
  }

  const selectedCount = $derived(importableCandidates(candidates).length);

  async function importSkills(): Promise<void> {
    if (busy || selectedCount === 0) return;
    busy = true;
    const selected = importableCandidates(candidates);
    const succeeded = new Set<string>();
    let created = 0;
    let reused = 0;
    const failures: string[] = [];

    for (const candidate of selected) {
      try {
        const result = await saveSkill(candidate.raw, { origin: 'imported', label: 'Imported SKILL.md' });
        if (result.created) created++;
        else reused++;
        succeeded.add(candidate.key);
      } catch (error) {
        failures.push(`${candidate.filename}: ${messageFrom(error)}`);
      }
    }
    candidates = candidates.filter((candidate) => !succeeded.has(candidate.key));
    busy = false;

    if (created > 0 || reused > 0) {
      notify(`Imported ${created} new skill${created === 1 ? '' : 's'}${reused > 0 ? `, reused ${reused} existing version${reused === 1 ? '' : 's'}` : ''}.`, 'good');
      onimported();
    }
    if (failures.length > 0) notify(failures.join(' · '), 'bad');
  }

  async function inspectBundle(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    bundlePlan = null;
    bundleName = file.name;
    bundleDiagnostics = [];

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = await planBundleImport(parsed);
      bundleDiagnostics = result.diagnostics;
      if (result.ok && result.plan) {
        bundlePlan = result.plan;
        notify(`Verified ${result.plan.skills.length} skill(s) in ${file.name}. Nothing has been written yet.`, 'good');
      } else {
        notify('Bundle verification failed. No data was written.', 'bad');
      }
    } catch (error) {
      bundleDiagnostics = [{ code: 'BUNDLE000', severity: 'error', path: '/', message: messageFrom(error) }];
      notify('Could not read that bundle file.', 'bad');
    }
  }

  async function commitBundle(): Promise<void> {
    if (!bundlePlan || busy) return;
    busy = true;
    try {
      await putBundleRecords(bundlePlan.skills, bundlePlan.versions);
      notify(`Imported ${bundlePlan.skills.length} skill(s) and ${bundlePlan.versions.length} version(s) atomically.`, 'good');
      bundlePlan = null;
      bundleDiagnostics = [];
      onimported();
    } catch (error) {
      notify(`Bundle import failed: ${messageFrom(error)}`, 'bad');
    } finally {
      busy = false;
    }
  }
</script>

<section aria-labelledby="import-title" class="space-y-4">
  <div>
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400/80">Import</p>
    <h1 id="import-title" class="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">Bring in a SKILL.md</h1>
    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-mist-200/60">
      Every document is parsed against the SKILL.md conformance rules. Errors block import; warnings and notes stay visible for
      your review.
    </p>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="file-import-title">
      <h2 id="file-import-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <FileUp size={16} class="text-accent-400" aria-hidden="true" /> From files
      </h2>
      <label
        class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 bg-ink-950/50 px-5 py-9 text-center transition hover:border-accent-400/50 hover:bg-accent-500/5"
      >
        <input type="file" accept=".md,.markdown,text/markdown" multiple onchange={handleSkillFiles} class="sr-only" />
        <Upload size={22} class="text-accent-400" aria-hidden="true" />
        <span class="mt-3 text-sm font-semibold text-mist-100">Choose one or more Markdown files</span>
        <span class="mt-1 text-xs text-mist-200/50">Standalone SKILL.md files · UTF-8 · up to 256 KiB each</span>
      </label>
    </section>

    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="paste-import-title">
      <h2 id="paste-import-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <FileText size={16} class="text-accent-400" aria-hidden="true" /> From pasted text
      </h2>
      <label for="paste-skill" class="mt-4 block text-xs font-medium text-mist-200/60">SKILL.md contents</label>
      <textarea
        id="paste-skill"
        bind:value={pasteText}
        rows="7"
        placeholder={'---\nname: my-skill\ndescription: What it does and when to use it.\n---\n\nWrite the instructions here.'}
        class="mt-2 w-full resize-y rounded-xl border border-ink-700 bg-ink-950/70 p-3 font-mono text-xs leading-relaxed text-mist-100 placeholder:text-mist-200/25 focus:border-accent-400/50 focus:outline-none"
      ></textarea>
      <div class="mt-3 flex justify-end">
        <button
          type="button"
          onclick={addPasted}
          disabled={pasteText.trim().length === 0}
          class="inline-flex items-center gap-2 rounded-xl border border-accent-400/30 bg-accent-500/10 px-3.5 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={14} aria-hidden="true" /> Validate text
        </button>
      </div>
    </section>
  </div>

  {#if candidates.length > 0}
    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="candidates-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="candidates-title" class="text-sm font-semibold text-mist-100">
          Review queue <span class="font-mono text-xs font-normal text-mist-200/45">({candidates.length})</span>
        </h2>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-mist-200/45">{selectedCount} selected for import</span>
          <button
            type="button"
            onclick={importSkills}
            disabled={busy || selectedCount === 0}
            class="inline-flex items-center gap-2 rounded-xl border border-accent-400/30 bg-accent-500/15 px-3 py-1.5 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={14} aria-hidden="true" /> {busy ? 'Importing…' : 'Import selected'}
          </button>
          <button
            type="button"
            onclick={() => (candidates = [])}
            class="rounded-lg p-1.5 text-mist-200/45 transition hover:text-bad-400"
            aria-label="Clear review queue"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="mt-4 space-y-3">
        {#each candidates as candidate (candidate.key)}
          {@const decision = importDecision(candidate.validation)}
          <article class="rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3 sm:p-4">
            <div class="flex flex-wrap items-center gap-2">
              <FileText size={15} class="shrink-0 text-mist-200/45" aria-hidden="true" />
              <h3 class="min-w-0 truncate font-mono text-xs font-semibold text-mist-100">{candidate.filename}</h3>
              <SeverityChip severity={decision === 'ready' ? 'info' : decision === 'review' ? 'warning' : 'error'} />
              <span class="text-[11px] text-mist-200/55">
                {decision === 'blocked' ? 'Blocked by errors' : decision === 'review' ? 'Review warnings' : 'Ready to import'}
              </span>
              <span class="ml-auto font-mono text-[10px] text-mist-200/35">
                {candidate.identity ? shortHash(candidate.identity) : 'no identity'}
              </span>
              <button
                type="button"
                onclick={() => removeCandidate(candidate.key)}
                class="rounded-lg p-1 text-mist-200/40 transition hover:text-bad-400"
                aria-label={`Remove ${candidate.filename} from queue`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-mist-200/50">
              {#if decision === 'blocked'}
                <span class="rounded-full bg-bad-400/10 px-2 py-0.5 text-bad-400">
                  {countBySeverity(candidate.validation.diagnostics, 'error')} blocking error(s)
                </span>
              {:else}
                <label class="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink-800/70 px-2.5 py-1">
                  <input
                    type="checkbox"
                    checked={candidate.included}
                    onchange={() => toggleCandidate(candidate.key)}
                    class="h-3.5 w-3.5 accent-[#38bdf8]"
                  />
                  Include in import
                </label>
              {/if}
              <span>{candidate.validation.document?.name ?? 'unparsed document'}</span>
            </div>

            <div class="mt-3">
              <Diagnostics
                diagnostics={candidate.validation.diagnostics}
                title={`Diagnostics for ${candidate.filename}`}
                emptyMessage="Conformant SKILL.md — no diagnostics."
              />
            </div>
          </article>
        {/each}
      </div>
    </section>
  {:else}
    <div class="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-5 py-10 text-center">
      <Package size={24} class="mx-auto text-mist-200/30" aria-hidden="true" />
      <p class="mt-3 text-sm font-medium text-mist-200/70">Nothing queued yet</p>
      <p class="mt-1 text-xs text-mist-200/45">Choose files above or paste SKILL.md text to see diagnostics before importing.</p>
    </div>
  {/if}

  <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="bundle-import-title">
    <h2 id="bundle-import-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
      <Package size={16} class="text-accent-400" aria-hidden="true" /> Portable bundle
    </h2>
    <p class="mt-2 text-xs leading-relaxed text-mist-200/55">
      A skill-pack JSON bundle carries every current SKILL.md plus its full version history. Every item hash and manifest is
      verified before anything is written.
    </p>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <label
        class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-100 transition hover:border-accent-400/40"
      >
        <input type="file" accept=".json,application/json" onchange={inspectBundle} class="sr-only" />
        <Upload size={14} aria-hidden="true" /> Verify bundle
      </label>
      {#if bundleName}
        <span class="min-w-0 truncate font-mono text-[11px] text-mist-200/50">{bundleName}</span>
      {/if}
      {#if bundlePlan}
        <button
          type="button"
          onclick={commitBundle}
          disabled={busy}
          class="inline-flex items-center gap-2 rounded-xl border border-good-400/30 bg-good-400/10 px-3.5 py-2 text-xs font-semibold text-good-400 transition hover:bg-good-400/20 disabled:opacity-40"
        >
          <RotateCcw size={14} aria-hidden="true" /> {busy ? 'Writing…' : `Import ${bundlePlan.skills.length} skill(s)`}
        </button>
      {/if}
    </div>
    {#if bundleDiagnostics.length > 0}
      <div class="mt-4">
        <Diagnostics diagnostics={bundleDiagnostics} title="Bundle verification" emptyMessage="Bundle verified." />
      </div>
    {/if}
  </section>
</section>
