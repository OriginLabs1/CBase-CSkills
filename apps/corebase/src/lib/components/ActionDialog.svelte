<script lang="ts">
  import { onMount, untrack } from 'svelte';

  interface Props {
    title: string;
    message: string;
    confirmLabel: string;
    valueLabel?: string;
    initialValue?: string;
    placeholder?: string;
    danger?: boolean;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  }

  let {
    title,
    message,
    confirmLabel,
    valueLabel,
    initialValue = '',
    placeholder = '',
    danger = false,
    onConfirm,
    onCancel,
  }: Props = $props();

  let value = $state(untrack(() => initialValue));
  let input = $state<HTMLInputElement | undefined>();
  let button = $state<HTMLButtonElement | undefined>();

  onMount(() => (valueLabel ? input?.focus() : button?.focus()));

  function confirm(): void {
    onConfirm(value.trim());
  }
</script>

<div class="fixed inset-0 z-50 grid place-items-center p-4">
  <div class="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" aria-hidden="true"></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="action-title"
    class="relative w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl shadow-black/50"
  >
    <form
      onsubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <h2 id="action-title" class="text-base font-semibold">{title}</h2>
      <p class="mt-1.5 text-xs leading-relaxed text-mist-200/50">{message}</p>
      {#if valueLabel}
        <label for="action-value" class="mt-4 block text-[11px] uppercase tracking-wider text-mist-200/40">{valueLabel}</label>
        <input
          id="action-value"
          bind:this={input}
          bind:value
          {placeholder}
          autocomplete="off"
          class="mt-1.5 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
        />
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" onclick={onCancel} class="rounded-lg border border-ink-700 px-3 py-2 text-xs text-mist-200/70 hover:text-mist-100">Cancel</button>
        <button
          type="submit"
          bind:this={button}
          disabled={Boolean(valueLabel) && value.length === 0}
          class={`rounded-lg px-3 py-2 text-xs font-medium text-ink-950 disabled:opacity-40 ${danger ? 'bg-bad-400 hover:bg-bad-400/85' : 'bg-accent-500 hover:bg-accent-400'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  </div>
</div>
