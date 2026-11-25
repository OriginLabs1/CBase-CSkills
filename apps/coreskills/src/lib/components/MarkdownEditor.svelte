<script lang="ts">
  import { indentWithTab } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap } from '@codemirror/view';
  import { basicSetup } from 'codemirror';
  import { onMount } from 'svelte';

  interface Props {
    value: string;
    onchange: (value: string) => void;
    label?: string;
  }

  let { value, onchange, label = 'SKILL.md markdown editor' }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let editor: EditorView | undefined;
  let changeHandler = $state<(value: string) => void>(() => {});

  $effect(() => {
    changeHandler = onchange;
  });

  onMount(() => {
    if (!host) return;

    const dark = EditorView.theme(
      {
        '&': {
          color: 'var(--color-mist-100)',
          backgroundColor: 'transparent',
          fontSize: '13px',
          height: '100%'
        },
        '.cm-content': {
          caretColor: 'var(--color-accent-400)',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.7',
          padding: '14px 0'
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent-400)' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'rgba(56, 189, 248, 0.20)'
        },
        '.cm-gutters': {
          backgroundColor: 'var(--color-ink-900)',
          color: 'var(--color-mist-200)',
          border: 'none',
          borderRight: '1px solid var(--color-ink-800)',
          opacity: '0.65'
        },
        '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
        '.cm-activeLineGutter': { backgroundColor: 'rgba(125, 211, 252, 0.08)', color: 'var(--color-accent-400)' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
        '&.cm-focused': { outline: 'none' }
      },
      { dark: true }
    );

    editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          dark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeHandler(update.state.doc.toString());
          })
        ]
      }),
      parent: host
    });

    return () => {
      editor?.destroy();
      editor = undefined;
    };
  });

  $effect(() => {
    const next = value;
    const currentEditor = editor;
    if (!currentEditor) return;
    const current = currentEditor.state.doc.toString();
    if (current !== next) {
      currentEditor.dispatch({ changes: { from: 0, to: current.length, insert: next } });
    }
  });
</script>

<div
  bind:this={host}
  role="group"
  aria-label={label}
  class="h-[min(60vh,520px)] min-h-[320px] overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/40"
></div>
