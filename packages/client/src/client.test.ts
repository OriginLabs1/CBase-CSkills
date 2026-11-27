import { describe, expect, it } from 'vitest';
import { validateTemplate, verifyTemplateFiles } from '@oneorigin/templates';
import { getOrCreateLocalIdentity, readLocalIdentity, shortIdentity } from './local.js';
import { ServiceClient, ServiceError } from './service.js';
import { builtinTemplates, renderSkillTemplate, renderTextFiles } from './templates.js';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function fakeFetch(handler: (url: string, init?: RequestInit) => { status?: number; body?: unknown }) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const result = handler(url, init);
    return new Response(JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('local identity', () => {
  it('is stable, provider-independent and never a service account', async () => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
    const first = await getOrCreateLocalIdentity();
    const second = await getOrCreateLocalIdentity();
    expect(first.id).toBe(second.id);
    expect(first.id).toMatch(/^urn:oneorigin:identity:[0-9a-f]{64}$/);
    expect(first.registered).toBe(false);
    expect(readLocalIdentity()?.id).toBe(first.id);
    expect(shortIdentity(first.id)).toContain('…');
  });
});

describe('service client', () => {
  it('calls the optional service with credentials and maps errors', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new ServiceClient({
      baseUrl: 'http://localhost:8787/',
      fetch: fakeFetch((url, init) => {
        calls.push({ url, init });
        if (url.endsWith('/auth/email/verify')) return { status: 400, body: { error: { code: 'invalid_code', message: 'Bad code.' } } };
        if (url.endsWith('/auth/session')) return { body: { id: 'session.1', identityId: `urn:oneorigin:identity:${'a'.repeat(64)}`, issuedAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z' } };
        return { body: { challengeId: 'challenge.1', expiresAt: '2026-01-01T00:05:00Z' } };
      }),
    });
    expect((await client.requestEmailCode('ada@example.test')).challengeId).toBe('challenge.1');
    expect((await client.status())?.mode).toBe('connected');
    expect(calls[0].init?.credentials).toBe('include');
    await expect(client.verifyEmailCode('challenge.1', '000000')).rejects.toMatchObject({
      status: 400, code: 'invalid_code',
    });
    await expect(client.verifyEmailCode('challenge.1', '000000')).rejects.toBeInstanceOf(ServiceError);
  });

  it('returns guest status on an unauthenticated session', async () => {
    const client = new ServiceClient({
      fetch: fakeFetch(() => ({ status: 401, body: { error: { code: 'unauthorized', message: 'No session.' } } })),
    });
    expect(await client.status()).toBeNull();
  });

  it('bounds a hanging request so guest mode cannot stall', async () => {
    const hangingFetch = ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    const client = new ServiceClient({ fetch: hangingFetch, timeoutMs: 10 });
    await expect(client.health()).rejects.toThrow('aborted');
  });
});

describe('built-in templates', () => {
  it('ships valid, hash-verified templates for both products', async () => {
    const all = await builtinTemplates();
    expect(all).toHaveLength(4);
    for (const template of all) {
      expect(validateTemplate(template).ok).toBe(true);
      expect((await verifyTemplateFiles(template)).ok).toBe(true);
    }
    expect((await builtinTemplates('corebase')).every((t) => t.product === 'corebase')).toBe(true);
    expect((await builtinTemplates('coreskills')).every((t) => t.product === 'coreskills')).toBe(true);
  });

  it('renders typed inputs into reviewable text', async () => {
    const [skill] = (await builtinTemplates('coreskills')).filter((template) => template.kind === 'skill');
    const markdown = await renderSkillTemplate(skill, {
      skillName: 'pdf-review',
      purpose: 'Review a PDF against a checklist.',
    });
    expect(markdown).toContain('name: pdf-review');
    expect(markdown).toContain('Review a PDF against a checklist.');
    expect(markdown).not.toContain('{{');

    const [workspace] = await builtinTemplates('corebase');
    const files = await renderTextFiles(workspace, { projectName: 'Research', purpose: 'Local notes.' });
    expect(files.map((file) => file.path)).toContain('README.md');
    expect(files[0].content).toContain('# Research');
  });
});
