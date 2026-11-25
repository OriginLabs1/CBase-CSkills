<script lang="ts">
  import { untrack } from 'svelte';
  import { basicSetup } from 'codemirror';
  import { Compartment, EditorState } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { javascript } from '@codemirror/lang-javascript';
  import { FileCode, FileText, Save, Trash } from '@lucide/svelte';
  import type { VirtualFile } from '../types';

  interface Props {
    file: VirtualFile | null;
    dirty: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    onDelete: () => void;
  }

  let { file, dirty, onChange, onSave, onDelete }: Props = $props();

  const language = new Compartment();
  const darkTheme = EditorView.theme(
    {
      '&': {
        color: 'var(--color-mist-100)',
        backgroundColor: 'var(--color-ink-950)',
        height: '100%',
        fontSize: '13px',
      },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
      '.cm-content': { caretColor: 'var(--color-accent-400)', padding: '12px 0' },
      '.cm-gutters': {
        backgroundColor: 'var(--color-ink-900)',
        color: 'var(--color-ink-600)',
        border: 'none',
      },
      '.cm-activeLine': { backgroundColor: 'rgba(56, 189, 248, 0.04)' },
      '.cm-activeLineGutter': { backgroundColor: 'var(--color-ink-850)' },
      '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent-400)' },
      '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(56, 189, 248, 0.18)' },
    },
    { dark: true },
  );

  function languageFor(path: string): 'markdown' | 'javascript' {
    return path.toLowerCase().endsWith('.md') ? 'markdown' : 'javascript';
  }

  let host: HTMLDivElement | undefined = $state();
  let editorKey = $state('');
  let view: EditorView | undefined;
  let activeKey = '';
  let applyingExternal = false;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && !applyingExternal) onChange(update.state.doc.toString());
  });

  $effect(() => {
    const path = file?.path ?? '';
    editorKey = `${path}::${languageFor(path)}`;
  });

  $effect(() => {
    const key = editorKey;
    if (!host || key === activeKey) return;
    activeKey = key;
    view?.destroy();
    const doc = untrack(() => file?.content ?? '');
    const lang = key.endsWith('::markdown') ? markdown() : javascript();
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc,
        extensions: [basicSetup, language.of(lang), keymap.of([indentWithTab]), darkTheme, updateListener],
      }),
    });
    return () => {
      view?.destroy();
      view = undefined;
      activeKey = '';
    };
  });

  $effect(() => {
    const value = file?.content;
    if (!view || value === undefined || value === view.state.doc.toString()) return;
    applyingExternal = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    applyingExternal = false;
  });
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-800 px-4 py-2.5">
    {#if file}
      <span class="flex min-w-0 items-center gap-2 text-sm text-mist-100">
        {#if file.path.endsWith('.md')}<FileText size={15} class="shrink-0 text-accent-400" />{:else}<FileCode size={15} class="shrink-0 text-accent-400" />{/if}
        <span class="truncate font-mono text-[12.5px]">{file.path}</span>
      </span>
      {#if dirty}
        <span class="rounded-full bg-warn-400/10 px-2 py-0.5 text-[10px] text-warn-400">Unsaved changes</span>
      {:else}
        <span class="rounded-full bg-good-400/10 px-2 py-0.5 text-[10px] text-good-400">Saved locally</span>
      {/if}
      <div class="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onclick={onSave}
          class="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-mist-200/80 hover:border-accent-500/40 hover:text-accent-400"
        >
          <Save size={13} /> Save
        </button>
        <button
          type="button"
          aria-label={`Delete ${file.path}`}
          onclick={onDelete}
          class="rounded-lg border border-ink-700 p-1.5 text-mist-200/60 hover:border-bad-400/40 hover:text-bad-400"
        >
          <Trash size={13} />
        </button>
      </div>
    {:else}
      <span class="text-sm text-mist-200/50">No file open</span>
    {/if}
  </div>

  <div class="relative min-h-0 flex-1">
    {#if file}
      <div bind:this={host} class="absolute inset-0 overflow-hidden" aria-label={`Editor for ${file.path}`}></div>
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span class="grid size-12 place-items-center rounded-xl bg-ink-800 text-accent-400"><FileText size={22} /></span>
        <p class="text-sm font-medium">Select a file to begin</p>
        <p class="max-w-sm text-xs leading-relaxed text-mist-200/40">
          Choose a file from the sidebar, or use the <strong class="text-mist-200/60">+</strong> button to create a Markdown or JavaScript file in this workspace.
        </p>
      </div>
    {/if}
  </div>
</div>
