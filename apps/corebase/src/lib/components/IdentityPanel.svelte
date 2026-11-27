<script lang="ts">
  import { CircleCheck, CircleExclamationPoint, KeyRound, LogOut, RefreshCw, Send } from '@lucide/svelte';
  import { shortIdentity, type ConsentGrant, type IdentityStatus, type RequestCodeResult } from '@oneorigin/client';

  interface Props {
    localIdentityId: string;
    status: IdentityStatus | null;
    serviceUrl: string;
    offlineMessage: string;
    grants: ConsentGrant[];
    onRequest: (email: string) => Promise<RequestCodeResult | null>;
    onVerify: (challengeId: string, code: string) => Promise<boolean>;
    onRefresh: () => void;
    onRevoke: () => void;
    onRevokeGrant: (id: string) => void;
  }

  let {
    localIdentityId, status, serviceUrl, offlineMessage, grants,
    onRequest, onVerify, onRefresh, onRevoke, onRevokeGrant,
  }: Props = $props();

  let email = $state('');
  let challengeId = $state('');
  let code = $state('');
  let message = $state('');
  let tone = $state<'info' | 'good' | 'bad'>('info');
  let busy = $state(false);

  async function request(): Promise<void> {
    if (busy || !email.trim()) return;
    busy = true;
    try {
      const result = await onRequest(email.trim());
      if (result) {
        challengeId = result.challengeId;
        message = 'Six-digit code sent. It expires in five minutes.';
        tone = 'good';
      }
    } finally {
      busy = false;
    }
  }

  async function verify(): Promise<void> {
    if (busy || !challengeId || !/^\d{6}$/.test(code)) return;
    busy = true;
    try {
      if (await onVerify(challengeId, code)) {
        code = '';
        challengeId = '';
        email = '';
        message = 'Connected. Local work remains guest-owned unless you share a consent grant.';
        tone = 'good';
      } else {
        message = 'That code was rejected. Request a fresh code and try again.';
        tone = 'bad';
      }
    } finally {
      busy = false;
    }
  }
</script>

<section class="rounded-xl border border-ink-800 bg-ink-900/60 p-4" aria-labelledby="identity-title">
  <h3 id="identity-title" class="flex items-center gap-2 text-sm font-medium"><KeyRound size={15} class="text-accent-400" /> Optional identity</h3>
  <p class="mt-2 text-[11px] leading-relaxed text-mist-200/45">
    Guest mode is complete on its own: no account, network or service is required. Connecting only adds portable identity, membership and consent records from an optional service at <code class="text-mist-200/70">{serviceUrl}</code>.
  </p>
  <p class="mt-2 font-mono text-[10px] text-mist-200/35" title={localIdentityId}>
    Local identity: {shortIdentity(localIdentityId)} · not registered
  </p>

  {#if offlineMessage}
    <p class="mt-2 flex items-start gap-1.5 rounded-lg border border-warn-400/25 bg-warn-400/5 p-2 text-[10px] text-warn-400">
      <CircleExclamationPoint size={11} class="mt-0.5 shrink-0" /> {offlineMessage}
    </p>
  {/if}

  {#if status}
    <div class="mt-3 rounded-lg border border-good-400/25 bg-good-400/5 p-3">
      <p class="flex items-center gap-1.5 text-[11px] text-good-400"><CircleCheck size={12} /> Connected identity</p>
      <p class="mt-1 font-mono text-[10px] text-mist-200/55" title={status.identityId}>{shortIdentity(status.identityId)}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button type="button" onclick={onRefresh} class="flex items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mist-200/70 hover:border-accent-500/50 hover:text-accent-400">
          <RefreshCw size={11} /> Refresh session
        </button>
        <button type="button" onclick={onRevoke} class="flex items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-[11px] text-mist-200/70 hover:border-bad-400/40 hover:text-bad-400">
          <LogOut size={11} /> Sign out
        </button>
      </div>
    </div>

    <div class="mt-3">
      <p class="text-[11px] text-mist-200/60">Consent grants ({grants.length})</p>
      {#if grants.length === 0}
        <p class="mt-1 text-[10px] text-mist-200/35">No active observation or administration consent.</p>
      {:else}
        <ul class="mt-2 space-y-2">
          {#each grants as grant (grant.id)}
            <li class="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5">
              <p class="text-[11px] text-mist-100">{grant.kind} · {grant.application} · {grant.status}</p>
              <p class="mt-0.5 text-[10px] text-mist-200/40">{grant.purpose}</p>
              <button
                type="button"
                disabled={grant.status === 'revoked' || grant.status === 'declined' || grant.status === 'expired'}
                onclick={() => onRevokeGrant(grant.id)}
                class="mt-1.5 rounded border border-ink-700 px-2 py-1 text-[10px] text-mist-200/60 hover:border-bad-400/40 hover:text-bad-400 disabled:opacity-30"
              >
                Revoke
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <div class="mt-3 space-y-2">
      <label class="block">
        <span class="text-[11px] text-mist-200/65">Email address</span>
        <input
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          class="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy || !email.includes('@')}
        onclick={() => void request()}
        class="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-ink-950 hover:bg-accent-400 disabled:opacity-40"
      >
        <Send size={12} /> Send one-time code
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
            class="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs tracking-widest placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !/^\d{6}$/.test(code)}
          onclick={() => void verify()}
          class="rounded-lg border border-accent-400/30 bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-400 hover:bg-accent-500/20 disabled:opacity-40"
        >
          Verify and connect
        </button>
      {/if}
    </div>
  {/if}

  {#if message}
    <p class={`mt-2 text-[10px] ${tone === 'bad' ? 'text-bad-400' : tone === 'good' ? 'text-good-400' : 'text-mist-200/50'}`}>{message}</p>
  {/if}
</section>
