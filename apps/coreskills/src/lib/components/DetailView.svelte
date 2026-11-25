<script lang="ts">
  import { ArrowLeft, CircleCheck, Copy, Download, FileCode, KeyRound, PenLine, RotateCcw, Shield } from '@lucide/svelte';
  import { formatDate, hashHex, shortHash, sortVersionsDesc } from '../helpers.js';
  import type { SkillRecord, SkillVersionRecord } from '../types.js';

  interface Props {
    skill: SkillRecord;
    versions: SkillVersionRecord[];
    restoring: boolean;
    onclose: () => void;
    onedit: () => void;
    onrestore: (identity: string) => void;
    ondownload: () => void;
  }

  let { skill, versions, restoring, onclose, onedit, onrestore, ondownload }: Props = $props();

  let copied = $state(false);

  const orderedVersions = $derived(sortVersionsDesc(versions));
  const permissions = $derived(skill.manifest.permissions ?? []);

  async function copyIdentity(): Promise<void> {
    try {
      await navigator.clipboard.writeText(skill.identity);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      copied = false;
    }
  }
</script>

<section aria-labelledby="detail-title" class="space-y-4">
  <div class="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <button
          type="button"
          onclick={onclose}
          class="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-mist-200/55 transition hover:text-accent-400"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to catalog
        </button>
        <div class="flex flex-wrap items-center gap-2">
          <h1 id="detail-title" class="text-xl font-semibold tracking-tight text-mist-100 sm:text-2xl">{skill.name}</h1>
          <span class="rounded-md bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-mist-200/60">v{skill.version}</span>
        </div>
        <p class="mt-1 font-mono text-xs text-mist-200/45">{skill.id}</p>
      </div>
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] text-mist-200/70"
      >
        <Shield size={12} aria-hidden="true" />
        {skill.origin === 'local' ? 'Created locally' : 'Imported from SKILL.md'}
      </span>
    </div>

    <p class="mt-4 text-sm leading-relaxed text-mist-200/75">{skill.description}</p>

    <div class="mt-5 flex flex-wrap gap-2">
      <button
        type="button"
        onclick={onedit}
        class="inline-flex items-center gap-2 rounded-xl border border-accent-400/30 bg-accent-500/10 px-3.5 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500/20"
      >
        <PenLine size={14} aria-hidden="true" /> Edit in author
      </button>
      <button
        type="button"
        onclick={ondownload}
        class="inline-flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-semibold text-mist-200 transition hover:border-accent-400/40 hover:text-mist-100"
      >
        <Download size={14} aria-hidden="true" /> Download SKILL.md
      </button>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="identity-title">
      <h2 id="identity-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <KeyRound size={15} class="text-accent-400" aria-hidden="true" /> Content identity
      </h2>
      <p class="mt-2 text-xs leading-relaxed text-mist-200/55">
        Identity is a SHA-256 digest of the canonical skill form. It identifies exact bytes — it does not mean the skill is
        safe or trustworthy.
      </p>
      <div class="mt-3 flex items-start gap-2 rounded-xl border border-ink-700/70 bg-ink-950/70 p-3">
        <code class="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-accent-400">{skill.identity}</code>
        <button
          type="button"
          onclick={copyIdentity}
          aria-label="Copy identity checksum"
          class="shrink-0 rounded-lg p-1.5 text-mist-200/50 transition hover:bg-ink-800 hover:text-accent-400"
        >
          {#if copied}<CircleCheck size={15} aria-hidden="true" />{:else}<Copy size={15} aria-hidden="true" />{/if}
        </button>
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <dt class="text-mist-200/45">Capability kind</dt>
        <dd class="font-mono text-mist-200/80">{skill.manifest.kind}</dd>
        <dt class="text-mist-200/45">First stored</dt>
        <dd class="text-mist-200/80">{formatDate(skill.createdAt)}</dd>
        <dt class="text-mist-200/45">Last changed</dt>
        <dd class="text-mist-200/80">{formatDate(skill.updatedAt)}</dd>
        <dt class="text-mist-200/45">Versions</dt>
        <dd class="text-mist-200/80">{versions.length}</dd>
      </dl>
    </section>

    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="permissions-title">
      <h2 id="permissions-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <Shield size={15} class="text-accent-400" aria-hidden="true" /> Requested permissions
      </h2>
      <p class="mt-2 text-xs leading-relaxed text-mist-200/55">
        Requests are advisory metadata. This catalog never grants them or executes instructions.
      </p>
      {#if permissions.length === 0}
        <p class="mt-3 rounded-xl border border-good-400/20 bg-good-400/5 px-3 py-3 text-xs text-good-400">
          No permissions requested (default deny).
        </p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each permissions as permission, index (index)}
            <li class="rounded-xl border border-ink-700/60 bg-ink-850/70 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <code class="font-mono text-xs text-mist-100">{permission.scope}</code>
                <span class="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-mist-200/70">
                  {permission.level}
                </span>
              </div>
              <p class="mt-1.5 text-xs leading-relaxed text-mist-200/60">{permission.reason}</p>
            </li>
          {/each}
        </ul>
      {/if}
      {#if skill.tags.length > 0}
        <div class="mt-4 flex flex-wrap gap-1.5">
          {#each skill.tags as tag (tag)}
            <span class="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-mist-200/60">#{tag}</span>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="history-title">
    <div class="flex items-center justify-between gap-3">
      <h2 id="history-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <FileCode size={15} class="text-accent-400" aria-hidden="true" /> Version history
      </h2>
      <span class="font-mono text-[11px] text-mist-200/45">{orderedVersions.length} immutable snapshot{orderedVersions.length === 1 ? '' : 's'}</span>
    </div>

    {#if orderedVersions.length === 0}
      <p class="mt-3 text-sm text-mist-200/50">No snapshots recorded for this skill yet.</p>
    {:else}
      <ul class="mt-3 space-y-2">
        {#each orderedVersions as version (version.key)}
          <li
            class="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between {version.identity ===
            skill.identity
              ? 'border-accent-400/35 bg-accent-500/5'
              : 'border-ink-700/60 bg-ink-850/60'}"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-xs font-semibold text-mist-100">v{version.version}</span>
                {#if version.identity === skill.identity}
                  <span class="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-400">
                    Current
                  </span>
                {/if}
                <span class="text-[11px] text-mist-200/45">{version.label}</span>
              </div>
              <p class="mt-1 font-mono text-[11px] text-mist-200/50" title={version.identity}>
                {shortHash(version.identity)} · {formatDate(version.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onclick={() => onrestore(version.identity)}
              disabled={restoring || version.identity === skill.identity}
              class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-[11px] font-semibold text-mist-200 transition hover:border-accent-400/40 hover:text-accent-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <RotateCcw size={12} aria-hidden="true" /> Restore
            </button>
          </li>
        {/each}
      </ul>
      <p class="mt-3 text-[11px] leading-relaxed text-mist-200/45">
        Restoring changes which snapshot is current. Earlier snapshots stay in the catalog and in exported bundles.
      </p>
    {/if}
  </section>

  <details class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4">
    <summary class="cursor-pointer text-sm font-semibold text-mist-200/80">View source SKILL.md</summary>
    <pre class="mt-3 max-h-80 overflow-auto rounded-xl border border-ink-800 bg-ink-950/80 p-3 font-mono text-[11px] leading-relaxed text-mist-200/70">{skill.raw}</pre>
  </details>

  <p class="px-1 text-[11px] text-mist-200/35">Full identity: sha256:{hashHex(skill.identity)}</p>
</section>
