import { afterEach, describe, expect, it } from 'vitest';
import { bytesToBase64, contentHash } from '@oneorigin/contracts';
import { hashIdentityId } from '@oneorigin/identity';
import { MemoryPersistenceAdapter } from '@oneorigin/persistence';
import { MemoryEmailSender } from './email.mjs';
import { createService } from './http.mjs';

const encoder = new TextEncoder();
const services = [];

async function start(options = {}) {
  const email = new MemoryEmailSender();
  const service = createService({
    adapter: new MemoryPersistenceAdapter('test', 'oneorigin-postgresql'),
    emailSender: email,
    ...options,
  });
  const address = await service.listen(0, '127.0.0.1');
  services.push(service);
  return { service, email, base: `http://127.0.0.1:${address.port}` };
}

async function call(base, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function signIn(base, address, sender) {
  const requested = await call(base, '/auth/email/request', { method: 'POST', body: { email: address } });
  expect(requested.status).toBe(202);
  const code = sender.lastCode(requested.body.challengeId);
  expect(code).toMatch(/^\d{6}$/);
  const verified = await call(base, '/auth/email/verify', {
    method: 'POST', body: { challengeId: requested.body.challengeId, code },
  });
  expect(verified.status).toBe(200);
  return verified;
}

afterEach(async () => {
  while (services.length) await services.pop().close();
});

describe('optional service', () => {
  it('reports health without authentication', async () => {
    const { base } = await start();
    const result = await call(base, '/health');
    expect(result.status).toBe(200);
    expect(result.body.version).toBe('0.0.2');
  });

  it('never exposes whether an account exists', async () => {
    const { base, email } = await start();
    for (const address of ['new@example.test', 'known@example.test']) {
      const result = await call(base, '/auth/email/request', { method: 'POST', body: { email: address } });
      expect(result.status).toBe(202);
      expect(email.messages.at(-1).to).toBe(address);
    }
  });

  it('rejects wrong codes, exhausts attempts, and accepts a fresh code', async () => {
    const { base, email } = await start();
    const first = await call(base, '/auth/email/request', { method: 'POST', body: { email: 'otp@example.test' } });
    const real = email.lastCode(first.body.challengeId);
    const badCode = real === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await call(base, '/auth/email/verify', {
        method: 'POST', body: { challengeId: first.body.challengeId, code: badCode },
      });
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe('invalid_code');
    }
    const exhausted = await call(base, '/auth/email/verify', {
      method: 'POST', body: { challengeId: first.body.challengeId, code: real },
    });
    expect(exhausted.status).toBe(400);

    const session = await signIn(base, 'otp@example.test', email);
    expect(session.body.identityId).toMatch(/^urn:oneorigin:identity:[0-9a-f]{64}$/);
    expect(session.cookie).toMatch(/^oneorigin_session=/);
  });

  it('reuses one identity across verified emails and rotates sessions', async () => {
    const { base, email } = await start();
    const first = await signIn(base, 'same@example.test', email);
    const second = await signIn(base, 'SAME@example.test', email);
    expect(second.body.identityId).toBe(first.body.identityId);

    const refreshed = await call(base, '/auth/session/refresh', { method: 'POST', cookie: first.cookie });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.id).not.toMatch(first.body.id);
    const old = await call(base, '/auth/session', { cookie: first.cookie });
    expect(old.status).toBe(401);
    const current = await call(base, '/auth/session', { cookie: refreshed.cookie });
    expect(current.status).toBe(200);

    const revoked = await call(base, '/auth/session/revoke', { method: 'POST', cookie: refreshed.cookie });
    expect(revoked.status).toBe(204);
    expect((await call(base, '/auth/session', { cookie: refreshed.cookie })).status).toBe(401);
  });

  it('enforces the full consent lifecycle before observability', async () => {
    const { base, email } = await start();
    const session = await signIn(base, 'observer@example.test', email);
    const subject = await hashIdentityId('subject@example.test');
    const grant = {
      schema: 'oneorigin.consent/v0.0.2',
      id: 'consent.observability.demo',
      kind: 'observability',
      subjectIdentityId: subject,
      granteeIdentityId: session.body.identityId,
      inviterIdentityId: session.body.identityId,
      application: 'corebase',
      purpose: 'Operational health',
      dataCategories: ['application-health'],
      operations: ['read'],
      scopeDisclosure: 'Operational health metadata only.',
      status: 'invited',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const unauthenticated = await call(base, '/consent-grants', { method: 'POST', body: grant });
    expect(unauthenticated.status).toBe(401);

    const authorized = await call(base, '/consent-grants', {
      method: 'POST', cookie: session.cookie, body: grant,
    });
    expect(authorized.status).toBe(201);

    const healthPath = `/observability/health?product=corebase&consentGrantId=${grant.id}`;
    expect((await call(base, healthPath, { cookie: session.cookie })).status).toBe(403);

    expect((await call(base, `/consent-grants/${grant.id}/accept`, {
      method: 'POST', cookie: session.cookie,
    })).status).toBe(409);
    expect((await call(base, `/consent-grants/${grant.id}/verify`, {
      method: 'POST', cookie: session.cookie, body: { verificationId: 'verification.1' },
    })).status).toBe(200);
    expect((await call(base, `/consent-grants/${grant.id}/disclose`, {
      method: 'POST', cookie: session.cookie, body: { scopeDisclosure: grant.scopeDisclosure },
    })).status).toBe(200);
    expect((await call(base, `/consent-grants/${grant.id}/accept`, {
      method: 'POST', cookie: session.cookie,
    })).status).toBe(200);

    const health = await call(base, healthPath, { cookie: session.cookie });
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('live');
    expect(health.body.health).not.toHaveProperty('raw');

    const envelope = await call(base, `/verification/${grant.id}`, { cookie: session.cookie });
    expect(envelope.body.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    expect((await call(base, `/consent-grants/${grant.id}/revoke`, {
      method: 'POST', cookie: session.cookie,
    })).status).toBe(200);
    expect((await call(base, healthPath, { cookie: session.cookie })).status).toBe(403);
  });

  it('validates templates without modifying the store', async () => {
    const { base } = await start();
    const bytes = encoder.encode('# Template\n');
    const template = {
      schema: 'oneorigin.template/v0.0.2',
      id: 'oneorigin.templates.service.test',
      name: 'Service test',
      version: '0.0.1',
      product: 'coreskills',
      kind: 'skill',
      summary: 'A template validated by the service.',
      files: [{ path: 'SKILL.md', mediaType: 'text/markdown', bytes: bytesToBase64(bytes), sha256: await contentHash(bytes) }],
    };
    const valid = await call(base, '/templates/validate', { method: 'POST', body: template });
    expect(valid.status).toBe(200);
    expect(valid.body.ok).toBe(true);
    const tampered = await call(base, '/templates/validate', {
      method: 'POST',
      body: { ...template, files: [{ ...template.files[0], sha256: `sha256:${'0'.repeat(64)}` }] },
    });
    expect(tampered.body.ok).toBe(false);
    expect(tampered.body.diagnostics.map((d) => d.code)).toContain('TF002');
  });
});
