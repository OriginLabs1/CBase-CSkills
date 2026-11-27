<script lang="ts">
  import { BookOpen, CircleCheck, HardDrive, Info, KeyRound, Lock, LogOut, Package, RefreshCw, Send, Shield, WifiOff } from '@lucide/svelte';
  import { shortIdentity, type ConsentGrant, type IdentityStatus, type RequestCodeResult } from '@oneorigin/client';

  interface Props {
    stats: { skills: number; versions: number };
    localIdentityId: string;
    status: IdentityStatus | null;
    serviceUrl: string;
    offlineMessage: string;
    grants: ConsentGrant[];
    onRequestCode: (email: string) => Promise<RequestCodeResult | null>;
    onVerifyCode: (challengeId: string, code: string) => Promise<boolean>;
    onRefreshIdentity: () => void;
    onRevokeIdentity: () => void;
    onRevokeGrant: (id: string) => void;
  }

  let {
    stats, localIdentityId, status, serviceUrl, offlineMessage, grants,
    onRequestCode, onVerifyCode, onRefreshIdentity, onRevokeIdentity, onRevokeGrant,
  }: Props = $props();

  let email = $state('');
  let challengeId = $state('');
  let code = $state('');
  let message = $state('');
  let busy = $state(false);

  async function request(): Promise<void> {
    if (busy || !email.trim()) return;
    busy = true;
    try {
      const result = await onRequestCode(email.trim());
      if (result) {
        challengeId = result.challengeId;
        message = 'Six-digit code sent. It expires in five minutes.';
      } else {
        message = 'Could not reach the optional service. Guest mode is unaffected.';
      }
    } finally {
      busy = false;
    }
  }

  async function verify(): Promise<void> {
    if (busy || !challengeId || !/^\d{6}$/.test(code)) return;
    busy = true;
    try {
      if (await onVerifyCode(challengeId, code)) {
        message = 'Connected. Your local catalog remains yours.';
        email = '';
        code = '';
        challengeId = '';
      } else {
        message = 'That code was rejected. Request a fresh code and try again.';
      }
    } finally {
      busy = false;
    }
  }

  const guestLimits = [
    'Full local catalog, authoring and import/export are available without an account.',
    'No sync across devices and no collaboration or shared workspaces.',
    'No privileged execution: instruction text is never run by this app.',
    'No ambient access to files, shell, network destinations or credentials.'
  ];

  const privacy = [
    'Skills, version history and settings live in IndexedDB on this device only.',
    'Nothing is uploaded; there is no telemetry and no analytics.',
    'Credentials are not stored in manifests, bundles, IndexedDB or local storage.',
    'Exported bundles contain only the SKILL.md bytes, manifests and version history you choose to export.'
  ];
</script>

<section aria-labelledby="about-title" class="space-y-4">
  <div>
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400/80">About &amp; settings</p>
    <h1 id="about-title" class="mt-1 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">Local by design</h1>
    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-mist-200/60">
      CoreSkills is a guest-first catalog for Skill Markdown documents. It reads, validates, versions and exports text — it does
      not decide that a skill is safe to use.
    </p>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="guest-title">
      <h2 id="guest-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <Lock size={16} class="text-accent-400" aria-hidden="true" /> Guest mode
      </h2>
      <p class="mt-2 text-xs leading-relaxed text-mist-200/55">Useful without registration, with clearly stated limits.</p>
      <ul class="mt-4 space-y-2.5">
        {#each guestLimits as item (item)}
          <li class="flex items-start gap-2 text-xs leading-relaxed text-mist-200/70">
            <CircleCheck size={14} class="mt-0.5 shrink-0 text-good-400" aria-hidden="true" />
            <span>{item}</span>
          </li>
        {/each}
      </ul>
    </section>

    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="privacy-title">
      <h2 id="privacy-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <WifiOff size={16} class="text-accent-400" aria-hidden="true" /> Local-only privacy
      </h2>
      <p class="mt-2 text-xs leading-relaxed text-mist-200/55">Your catalog is yours; it never leaves this browser.</p>
      <ul class="mt-4 space-y-2.5">
        {#each privacy as item (item)}
          <li class="flex items-start gap-2 text-xs leading-relaxed text-mist-200/70">
            <CircleCheck size={14} class="mt-0.5 shrink-0 text-good-400" aria-hidden="true" />
            <span>{item}</span>
          </li>
        {/each}
      </ul>
    </section>

    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="trust-title">
      <h2 id="trust-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <Shield size={16} class="text-accent-400" aria-hidden="true" /> What a checksum proves
      </h2>
      <p class="mt-3 text-sm leading-relaxed text-mist-200/70">
        A SHA-256 identity proves that bytes match a known version. It says nothing about intent, quality or safety.
      </p>
      <div class="mt-4 rounded-xl border border-warn-400/25 bg-warn-400/5 p-3 text-xs leading-relaxed text-warn-400">
        Never treat a checksum or signature as a “safe” badge. Read the instructions, review requested permissions and decide for
        yourself.
      </div>
      <p class="mt-3 text-xs leading-relaxed text-mist-200/55">
        Permission requests in a manifest are least-authority declarations. CoreSkills displays them but grants nothing; a host
        such as CoreBase must ask for explicit, revocable consent before any consequential action.
      </p>
    </section>

    <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="storage-title">
      <h2 id="storage-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
        <HardDrive size={16} class="text-accent-400" aria-hidden="true" /> Local storage
      </h2>
      <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl border border-ink-700/60 bg-ink-950/60 p-3">
          <dt class="text-mist-200/45">Skills</dt>
          <dd class="mt-1 font-mono text-lg text-mist-100">{stats.skills}</dd>
        </div>
        <div class="rounded-xl border border-ink-700/60 bg-ink-950/60 p-3">
          <dt class="text-mist-200/45">Immutable versions</dt>
          <dd class="mt-1 font-mono text-lg text-mist-100">{stats.versions}</dd>
        </div>
      </dl>
      <div class="mt-3 rounded-xl border border-ink-700/60 bg-ink-950/60 p-3">
        <p class="flex items-center gap-1.5 font-mono text-[11px] text-accent-400">
          <KeyRound size={12} aria-hidden="true" /> oneorigin-coreskills
        </p>
        <p class="mt-1.5 font-mono text-[11px] leading-relaxed text-mist-200/50">stores: skills · skill-versions · settings</p>
      </div>
      <p class="mt-3 text-[11px] leading-relaxed text-mist-200/45">
        Existing data is never replaced by example skills. First-run examples are written only into an empty catalog.
      </p>
    </section>
  </div>

  <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="identity-title">
    <h2 id="identity-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
      <KeyRound size={16} class="text-accent-400" aria-hidden="true" /> Optional identity
    </h2>
    <p class="mt-2 text-xs leading-relaxed text-mist-200/55">
      Everything above works without an account. Connecting adds portable identity, membership and consent records from an
      optional service at <code class="text-mist-200/70">{serviceUrl}</code>; it grants no ambient access to your catalog.
    </p>
    <p class="mt-2 font-mono text-[10px] text-mist-200/40" title={localIdentityId}>
      Local identity: {shortIdentity(localIdentityId)} · not registered
    </p>

    {#if offlineMessage}
      <p class="mt-2 rounded-xl border border-warn-400/25 bg-warn-400/5 p-2 text-[11px] leading-relaxed text-warn-400">
        {offlineMessage}
      </p>
    {/if}

    {#if status}
      <div class="mt-3 rounded-xl border border-good-400/25 bg-good-400/5 p-3">
        <p class="flex items-center gap-1.5 text-[11px] text-good-400"><CircleCheck size={12} aria-hidden="true" /> Connected identity</p>
        <p class="mt-1 font-mono text-[10px] text-mist-200/50" title={status.identityId}>{shortIdentity(status.identityId)}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onclick={onRefreshIdentity}
            class="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-mist-200/70 hover:border-accent-500/50 hover:text-accent-400"
          >
            <RefreshCw size={11} aria-hidden="true" /> Refresh session
          </button>
          <button
            type="button"
            onclick={onRevokeIdentity}
            class="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-mist-200/70 hover:border-bad-400/40 hover:text-bad-400"
          >
            <LogOut size={11} aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>

      <p class="mt-3 text-[11px] text-mist-200/60">Consent grants ({grants.length})</p>
      {#if grants.length === 0}
        <p class="mt-1 text-[10px] text-mist-200/35">No active observation or administration consent.</p>
      {:else}
        <ul class="mt-2 space-y-2">
          {#each grants as grant (grant.id)}
            <li class="rounded-xl border border-ink-700/60 bg-ink-950/60 p-2.5">
              <p class="text-[11px] text-mist-100">{grant.kind} · {grant.application} · {grant.status}</p>
              <p class="mt-0.5 text-[10px] text-mist-200/40">{grant.purpose}</p>
              <button
                type="button"
                disabled={grant.status === 'revoked' || grant.status === 'declined' || grant.status === 'expired'}
                onclick={() => onRevokeGrant(grant.id)}
                class="mt-1.5 rounded-lg border border-ink-700 px-2 py-1 text-[10px] text-mist-200/60 hover:border-bad-400/40 hover:text-bad-400 disabled:opacity-30"
              >
                Revoke
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <div class="mt-3 space-y-2">
        <label class="block">
          <span class="text-[11px] text-mist-200/65">Email address</span>
          <input
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            class="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-xs placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !email.includes('@')}
          onclick={() => void request()}
          class="inline-flex items-center gap-1.5 rounded-xl border border-accent-400/30 bg-accent-500/10 px-3 py-2 text-xs font-semibold text-accent-400 hover:bg-accent-500/20 disabled:opacity-40"
        >
          <Send size={12} aria-hidden="true" /> Send one-time code
        </button>
        {#if challengeId}
          <label class="block">
            <span class="text-[11px] text-mist-200/65">Six-digit code</span>
            <input
              type="text"
              inputmode="numeric"
              maxlength="6"
              bind:value={code}
              placeholder="000000"
              class="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs tracking-widest placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || !/^\d{6}$/.test(code)}
            onclick={() => void verify()}
            class="rounded-xl border border-accent-400/30 bg-accent-500/15 px-3 py-2 text-xs font-semibold text-accent-400 hover:bg-accent-500/25 disabled:opacity-40"
          >
            Verify and connect
          </button>
        {/if}
      </div>
    {/if}

    {#if message}
      <p class="mt-2 text-[10px] text-mist-200/50">{message}</p>
    {/if}
  </section>

  <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="portability-title">
    <h2 id="portability-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
      <Package size={16} class="text-accent-400" aria-hidden="true" /> Portability
    </h2>
    <div class="mt-3 grid gap-3 text-xs leading-relaxed text-mist-200/65 sm:grid-cols-2">
      <p>
        Each skill downloads as its original SKILL.md bytes. A skill-pack bundle is a JSON file with base64 items, per-item
        hashes, capability manifests and full version history.
      </p>
      <p>
        Imports verify schema, paths, item hashes, manifests and bundle signature before a single write. A failed verification
        changes nothing.
      </p>
    </div>
  </section>

  <section class="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 sm:p-5" aria-labelledby="spec-title">
    <h2 id="spec-title" class="flex items-center gap-2 text-sm font-semibold text-mist-100">
      <BookOpen size={16} class="text-accent-400" aria-hidden="true" /> Conformance
    </h2>
    <p class="mt-3 text-xs leading-relaxed text-mist-200/60">
      Implements OneOrigin v0.0.1 capability manifests, SKILL.md conformance, trust and permission rules, and the portable bundle
      format. Unknown frontmatter and manifest fields are preserved rather than rejected.
    </p>
    <p class="mt-3 flex items-start gap-1.5 text-[11px] text-mist-200/40">
      <Info size={13} class="mt-0.5 shrink-0" aria-hidden="true" />
      Validation diagnostics use stable codes so the same input always produces the same report.
    </p>
  </section>
</section>
