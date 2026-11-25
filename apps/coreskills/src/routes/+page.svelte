<script lang="ts">
  import { CircleCheck, CircleExclamationPoint, Info, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import AboutView from '../lib/components/AboutView.svelte';
  import AppHeader from '../lib/components/AppHeader.svelte';
  import CatalogView from '../lib/components/CatalogView.svelte';
  import DetailView from '../lib/components/DetailView.svelte';
  import ImportView from '../lib/components/ImportView.svelte';
  import { createSkillBundle } from '../lib/bundle.js';
  import { ensureSeeded, listSkills, listVersions, restoreVersion, storageStats } from '../lib/storage.js';
  import type { SkillRecord, SkillVersionRecord, ToastMessage, ViewName } from '../lib/types.js';

  const STARTER = `---
name: new-skill
description: Describe what this skill does and when to use it. Keep the first sentence short.
version: 0.1.0
tags: [draft]
---

# New skill

Write the instructions a human should follow. This text is advisory; it is never executed by the catalog.
`;

  type AuthorComponent = typeof import('../lib/components/AuthorView.svelte').default;

  let view = $state<ViewName>('catalog');
  let AuthorView = $state<AuthorComponent | null>(null);
  let skills = $state<SkillRecord[]>([]);
  let selectedId = $state<string | null>(null);
  let versions = $state<SkillVersionRecord[]>([]);
  let stats = $state({ skills: 0, versions: 0 });
  let loading = $state(true);
  let loadError = $state('');
  let exporting = $state(false);
  let restoring = $state(false);
  let authorRaw = $state(STARTER);
  let authorSeed = $state(0);
  let toast = $state<ToastMessage | null>(null);

  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const selected = $derived(skills.find((skill) => skill.id === selectedId) ?? null);

  onMount(() => {
    void initialise();
    return () => {
      if (toastTimer) clearTimeout(toastTimer);
    };
  });

  function notify(message: string, tone: ToastMessage['tone']): void {
    toast = { message, tone };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 6000);
  }

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error.';
  }

  async function refresh(): Promise<void> {
    const [loaded, counts] = await Promise.all([listSkills(), storageStats()]);
    skills = loaded;
    stats = counts;
    if (selectedId && !loaded.some((skill) => skill.id === selectedId)) {
      selectedId = null;
      versions = [];
    }
  }

  async function initialise(): Promise<void> {
    try {
      await ensureSeeded();
      await refresh();
    } catch (error) {
      loadError = errorText(error);
    } finally {
      loading = false;
    }
  }

  async function selectSkill(id: string): Promise<void> {
    selectedId = id;
    try {
      versions = await listVersions(id);
    } catch (error) {
      notify(`Could not load version history: ${errorText(error)}`, 'bad');
    }
  }

  async function openAuthor(raw?: string): Promise<void> {
    authorRaw = raw ?? STARTER;
    authorSeed += 1;
    if (!AuthorView) {
      try {
        AuthorView = (await import('../lib/components/AuthorView.svelte')).default;
      } catch (error) {
        notify(`Could not load the editor: ${errorText(error)}`, 'bad');
        return;
      }
    }
    view = 'author';
  }

  async function restore(identity: string): Promise<void> {
    if (!selected || restoring) return;
    restoring = true;
    try {
      await restoreVersion(selected.id, identity);
      await refresh();
      versions = await listVersions(selected.id);
      notify('Older version is now current. Its history is intact.', 'good');
    } catch (error) {
      notify(`Restore failed: ${errorText(error)}`, 'bad');
    } finally {
      restoring = false;
    }
  }

  function download(text: string, filename: string, mediaType: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: mediaType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCurrent(): void {
    if (!selected) return;
    download(selected.raw, `${selected.name}-SKILL.md`, 'text/markdown;charset=utf-8');
  }

  async function exportAll(): Promise<void> {
    if (exporting || skills.length === 0) return;
    exporting = true;
    try {
      const grouped = await Promise.all(skills.map((skill) => listVersions(skill.id)));
      const bundle = await createSkillBundle(skills, grouped.flat());
      const stamp = new Date().toISOString().slice(0, 10);
      download(JSON.stringify(bundle, null, 2) + '\n', `oneorigin-skills-${stamp}.json`, 'application/json');
      notify(`Exported ${skills.length} skill(s) with ${bundle.items.length} verified items.`, 'good');
    } catch (error) {
      notify(`Export failed: ${errorText(error)}`, 'bad');
    } finally {
      exporting = false;
    }
  }
</script>

<svelte:head>
  <title>CoreSkills · Local SKILL.md catalog</title>
  <meta
    name="description"
    content="Import, author, version and export Agent Skills SKILL.md documents locally, with honest trust signals."
  />
</svelte:head>

<div class="min-h-screen bg-[radial-gradient(1000px_480px_at_50%_-140px,rgba(56,189,248,0.10),transparent_70%)]">
  <AppHeader {view} onview={(next) => (view = next)} onnew={() => openAuthor()} />

  <main class="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
    {#if loading}
      <div class="animate-pulse space-y-4" aria-label="Loading local catalog">
        <div class="h-8 w-64 rounded-lg bg-ink-800"></div>
        <div class="h-4 w-full max-w-xl rounded bg-ink-800/70"></div>
        <div class="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          {#each [1, 2, 3] as placeholder (placeholder)}
            <div class="h-44 rounded-2xl border border-ink-800 bg-ink-900/60"></div>
          {/each}
        </div>
      </div>
    {:else if loadError}
      <div class="mx-auto max-w-lg rounded-2xl border border-bad-400/30 bg-bad-400/5 p-6 text-center">
        <CircleExclamationPoint size={26} class="mx-auto text-bad-400" aria-hidden="true" />
        <h1 class="mt-3 text-lg font-semibold text-mist-100">Local storage is unavailable</h1>
        <p class="mt-2 text-sm leading-relaxed text-mist-200/60">{loadError}</p>
        <button
          type="button"
          onclick={() => {
            loadError = '';
            loading = true;
            void initialise();
          }}
          class="mt-4 rounded-xl border border-accent-400/30 bg-accent-500/10 px-4 py-2 text-xs font-semibold text-accent-400"
        >
          Try again
        </button>
      </div>
    {:else if view === 'import'}
      <ImportView notify={notify} onimported={() => void refresh()} />
    {:else if view === 'author'}
      {#if AuthorView}
        {#key authorSeed}
          <AuthorView
            initialRaw={authorRaw}
            {notify}
            ondone={(id) => {
              void refresh();
              void selectSkill(id);
              view = 'catalog';
            }}
          />
        {/key}
      {:else}
        <div class="rounded-2xl border border-ink-800 bg-ink-900/60 p-6 text-sm text-mist-200/60">Loading editor…</div>
      {/if}
    {:else if view === 'about'}
      <AboutView {stats} />
    {:else}
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(330px,380px)]">
        <div class={selected ? 'hidden lg:block' : ''}>
          <CatalogView
            {skills}
            selectedId={selectedId}
            exporting={exporting}
            onselect={(id) => void selectSkill(id)}
            onimport={() => (view = 'import')}
            onexportall={() => void exportAll()}
          />
        </div>

        {#if selected}
          <aside
            class="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:pr-1"
            aria-label={`Details for ${selected.name}`}
          >
            <DetailView
              skill={selected}
              {versions}
              {restoring}
              onclose={() => {
                selectedId = null;
                versions = [];
              }}
              onedit={() => openAuthor(selected.raw)}
              onrestore={(identity) => void restore(identity)}
              ondownload={downloadCurrent}
            />
          </aside>
        {:else}
          <aside class="hidden lg:block" aria-label="Skill details">
            <div class="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 p-8 text-center">
              <div class="max-w-xs">
                <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-800 text-mist-200/50">
                  <Info size={22} aria-hidden="true" />
                </div>
                <h2 class="mt-4 text-sm font-semibold text-mist-100">Select a skill</h2>
                <p class="mt-2 text-xs leading-relaxed text-mist-200/50">
                  Identity, permission requests and immutable version history appear here. Checksums identify bytes; they do not
                  certify safety.
                </p>
              </div>
            </div>
          </aside>
        {/if}
      </div>
    {/if}
  </main>

  <footer class="border-t border-ink-800/70 py-5 text-center text-[11px] text-mist-200/35">
    OneOrigin · CoreSkills v0.0.1 · Guest session · Stored only on this device
  </footer>
</div>

{#if toast}
  <div
    role="status"
    aria-live="polite"
    class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-start gap-2.5 rounded-2xl border bg-ink-850/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl {toast.tone ===
    'good'
      ? 'border-good-400/35 text-good-400'
      : toast.tone === 'bad'
        ? 'border-bad-400/35 text-bad-400'
        : 'border-accent-400/35 text-accent-400'}"
  >
    {#if toast.tone === 'good'}
      <CircleCheck size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
    {:else if toast.tone === 'bad'}
      <CircleExclamationPoint size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
    {:else}
      <Info size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
    {/if}
    <span class="flex-1 leading-relaxed text-mist-100">{toast.message}</span>
    <button
      type="button"
      onclick={() => (toast = null)}
      aria-label="Dismiss notification"
      class="shrink-0 rounded-lg p-1 text-mist-200/50 transition hover:text-mist-100"
    >
      <X size={14} aria-hidden="true" />
    </button>
  </div>
{/if}
