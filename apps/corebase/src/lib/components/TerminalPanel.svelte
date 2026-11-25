<script lang="ts">
  import { ArrowDown, ArrowUp, CornerDownLeft, SquareTerminal, Trash } from '@lucide/svelte';
  import type { TerminalLine } from '../types';

  interface Props {
    lines: TerminalLine[];
    history: string[];
    status: string;
    adapterName: string;
    cwd: string;
    busy: boolean;
    onRun: (command: string) => void;
    onClear: () => void;
  }

  let { lines, history, status, adapterName, cwd, busy, onRun, onClear }: Props = $props();

  let input = $state('');
  let historyIndex = $state(-1);
  let log: HTMLDivElement | undefined = $state();

  $effect(() => {
    lines.length;
    if (log) log.scrollTop = log.scrollHeight;
  });

  function submit(): void {
    const value = input.trim();
    if (!value || busy) return;
    onRun(value);
    input = '';
    historyIndex = -1;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'ArrowUp' && history.length > 0) {
      event.preventDefault();
      historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      input = history[historyIndex] ?? '';
      return;
    }
    if (event.key === 'ArrowDown' && historyIndex >= 0) {
      event.preventDefault();
      if (historyIndex >= history.length - 1) {
        historyIndex = -1;
        input = '';
      } else {
        historyIndex += 1;
        input = history[historyIndex] ?? '';
      }
    }
  }

  function color(kind: TerminalLine['kind']): string {
    switch (kind) {
      case 'input': return 'text-accent-400';
      case 'stderr':
      case 'error': return 'text-bad-400';
      case 'success': return 'text-good-400';
      case 'system': return 'text-mist-200/45';
      default: return 'text-mist-200/85';
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col bg-ink-950">
  <div class="flex flex-wrap items-center gap-2 border-b border-ink-800 px-4 py-2.5 text-[11px] text-mist-200/50">
    <span class="flex items-center gap-1.5 rounded-md border border-good-400/20 bg-good-400/5 px-2 py-1 text-good-400">
      <span class="size-1.5 rounded-full bg-good-400"></span> Sandboxed adapter: {adapterName}
    </span>
    <span>virtual cwd: /{cwd || '~'}</span>
    <span aria-live="polite" class="ml-auto">{status}</span>
    <button type="button" onclick={onClear} class="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-ink-800 hover:text-mist-100">
      <Trash size={12} /> Clear
    </button>
  </div>

  <div bind:this={log} class="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
    {#if lines.length === 0}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-center text-mist-200/35">
        <SquareTerminal size={26} />
        <p class="text-sm">No output yet</p>
        <p class="text-xs">Type <code class="rounded bg-ink-800 px-1">help</code> to see the bounded command set.</p>
      </div>
    {:else}
      <ul class="space-y-0.5">
        {#each lines as line (line.id)}
          <li class={`whitespace-pre-wrap break-words ${color(line.kind)}`}>
            <span class="mr-2 select-none text-ink-600">{new Date(line.at).toLocaleTimeString()}</span>{line.text}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <form
    class="flex items-center gap-2 border-t border-ink-800 bg-ink-900/60 px-3 py-3"
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}
  >
    <label for="terminal-input" class="sr-only">Virtual shell command</label>
    <span aria-hidden="true" class="hidden shrink-0 font-mono text-xs text-accent-400 sm:inline">guest@corebase:{cwd || '~'}$</span>
    <input
      id="terminal-input"
      bind:value={input}
      onkeydown={handleKeydown}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder={busy ? 'Running…' : 'Type a command and press Enter'}
      class="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-[13px] text-mist-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
    />
    <button
      type="submit"
      disabled={busy || input.trim().length === 0}
      aria-label="Run command"
      class="shrink-0 rounded-lg bg-accent-500 p-2 text-ink-950 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <CornerDownLeft size={16} />
    </button>
  </form>
  <p class="flex items-center gap-1.5 px-4 pb-2 text-[10px] text-mist-200/30">
    <ArrowUp size={11} /> <ArrowDown size={11} /> arrow keys recall session history · commands are never executed on the host
  </p>
</div>
