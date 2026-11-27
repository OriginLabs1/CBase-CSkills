import { createServer } from 'node:http';
import { randomId } from '@oneorigin/contracts';
import {
  createVerifiableEnvelope,
  effectiveConsentStatus,
  isConsentActive,
  transitionConsent,
  validateConsentGrant,
} from '@oneorigin/identity';
import { validateTemplate, verifyTemplateFiles } from '@oneorigin/templates';
import { MemoryPersistenceAdapter } from '@oneorigin/persistence';
import { DomainStore } from './store.mjs';
import { NoopEmailSender } from './email.mjs';
import {
  constantTimeEqual,
  generateCode,
  hashCode,
  hashEmail,
  isSixDigitCode,
  isValidEmail,
  normalizeEmail,
} from './otp.mjs';

const encoder = new TextEncoder();
const SESSION_COOKIE = 'oneorigin_session';
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(res, status, body, extra = {}) {
  const bytes = encoder.encode(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.length,
    ...extra,
  });
  res.end(bytes);
}

function noContent(res, extra = {}) {
  res.writeHead(204, extra);
  res.end();
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'payload_too_large', 'Request body is too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}

function parseCookies(header) {
  const result = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return result;
}

function sessionHeader(id, secure, ttlSeconds) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secure ? '; Secure' : ''}`;
}

function clearSessionHeader(secure) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

function rateLimit(bucket, key, limit, windowMs) {
  const now = Date.now();
  const entry = bucket.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  bucket.set(key, entry);
  return entry.count <= limit;
}

/**
 * Creates the optional HTTP service. Every deployment passes its own
 * PersistenceAdapter and EmailSender; no product depends on this server.
 */
export function createService(options = {}) {
  const adapter = options.adapter ?? new MemoryPersistenceAdapter('service', 'oneorigin-postgresql');
  const store = new DomainStore(adapter);
  const emailSender = options.emailSender ?? new NoopEmailSender();
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const secureCookies = options.secureCookies ?? false;
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const emailLimit = options.emailRateLimit ?? 5;
  const addressLimit = options.addressRateLimit ?? 30;
  const rateWindowMs = options.rateWindowMs ?? 60 * 60 * 1000;
  const emailBucket = new Map();
  const addressBucket = new Map();
  let streams = 0;

  async function requireSession(req) {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = id ? await store.getSession(id) : undefined;
    if (!session) throw new HttpError(401, 'unauthorized', 'An active session is required.');
    return session;
  }

  function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.writeHead(204);
      res.end();
      return true;
    }
    return false;
  }

  async function handle(req, res) {
    if (applyCors(req, res)) return;
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/health') {
      json(res, 200, { ok: true, version: '0.0.2', streams });
      return;
    }

    if (method === 'POST' && path === '/auth/email/request') {
      const body = await readJson(req);
      if (!isValidEmail(body.email)) throw new HttpError(400, 'invalid_email', 'A valid email address is required.');
      const emailHash = await hashEmail(body.email);
      const address = req.socket.remoteAddress ?? 'unknown';
      if (!rateLimit(emailBucket, `email:${emailHash}`, emailLimit, rateWindowMs)
        || !rateLimit(addressBucket, `address:${address}`, addressLimit, rateWindowMs)) {
        throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.');
      }
      const code = generateCode();
      const challenge = await store.createChallenge(emailHash, code);
      await emailSender.send({ to: normalizeEmail(body.email), code, challengeId: challenge.id });
      json(res, 202, { challengeId: challenge.id, expiresAt: challenge.expiresAt });
      return;
    }

    if (method === 'POST' && path === '/auth/email/verify') {
      const body = await readJson(req);
      if (typeof body.challengeId !== 'string' || !isSixDigitCode(body.code ?? '')) {
        throw new HttpError(400, 'invalid_code', 'The code is invalid or expired.');
      }
      const challenge = await store.getChallenge(body.challengeId);
      const reject = async () => {
        throw new HttpError(400, 'invalid_code', 'The code is invalid or expired.');
      };
      if (!challenge || challenge.status !== 'pending') await reject();
      if (Date.parse(challenge.expiresAt) <= Date.now()) {
        await store.saveChallenge({ ...challenge, status: 'expired' });
        await reject();
      }
      if (challenge.attempts >= challenge.maxAttempts) {
        await store.saveChallenge({ ...challenge, status: 'exhausted' });
        await reject();
      }
      if (!constantTimeEqual(challenge.codeHash, hashCode(body.code, challenge.id))) {
        const attempts = challenge.attempts + 1;
        await store.saveChallenge({
          ...challenge,
          attempts,
          status: attempts >= challenge.maxAttempts ? 'exhausted' : 'pending',
        });
        await reject();
      }
      await store.saveChallenge({ ...challenge, status: 'verified' });
      const identity = await store.getOrCreateIdentity(challenge.emailHash);
      const issuedAt = new Date();
      const session = {
        id: randomId(),
        identityId: identity.id,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + sessionTtlMs).toISOString(),
      };
      await store.saveSession(session);
      json(res, 200, session, {
        'set-cookie': sessionHeader(session.id, secureCookies, Math.floor(sessionTtlMs / 1000)),
      });
      return;
    }

    if (method === 'GET' && path === '/auth/session') {
      const session = await requireSession(req);
      json(res, 200, session);
      return;
    }

    if (method === 'POST' && path === '/auth/session/refresh') {
      const session = await requireSession(req);
      await store.revokeSession(session.id);
      const issuedAt = new Date();
      const rotated = {
        id: randomId(),
        identityId: session.identityId,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + sessionTtlMs).toISOString(),
      };
      await store.saveSession(rotated);
      json(res, 200, rotated, {
        'set-cookie': sessionHeader(rotated.id, secureCookies, Math.floor(sessionTtlMs / 1000)),
      });
      return;
    }

    if (method === 'POST' && path === '/auth/session/revoke') {
      const session = await requireSession(req);
      await store.revokeSession(session.id);
      noContent(res, { 'set-cookie': clearSessionHeader(secureCookies) });
      return;
    }

    if (method === 'GET' && path === '/memberships') {
      const session = await requireSession(req);
      const identityId = url.searchParams.get('identityId');
      if (identityId && identityId !== session.identityId) {
        throw new HttpError(403, 'forbidden', 'Only your own memberships are visible here.');
      }
      json(res, 200, await store.listMemberships(session.identityId));
      return;
    }

    if (method === 'GET' && path === '/consent-grants') {
      const session = await requireSession(req);
      json(res, 200, await store.listConsentsFor(session.identityId));
      return;
    }

    if (method === 'POST' && path === '/consent-grants') {
      const session = await requireSession(req);
      const body = await readJson(req);
      const report = validateConsentGrant(body);
      if (!report.ok) {
        throw new HttpError(400, 'invalid_grant', report.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Invalid grant.');
      }
      if (body.status !== 'invited' || body.inviterIdentityId !== session.identityId) {
        throw new HttpError(403, 'forbidden', 'Only an invited grant created by the caller may be stored.');
      }
      json(res, 201, await store.saveConsent(body));
      return;
    }

    const grantMatch = path.match(/^\/consent-grants\/([^/]+)$/);
    if (method === 'GET' && grantMatch) {
      const session = await requireSession(req);
      const grant = await store.getConsent(grantMatch[1]);
      if (!(await store.canAccessConsent(grant, session.identityId))) {
        throw new HttpError(404, 'not_found', 'Consent grant not found.');
      }
      json(res, 200, grant);
      return;
    }

    const actionMatch = path.match(/^\/consent-grants\/([^/]+)\/(verify|disclose|accept|decline|revoke|expire)$/);
    if (method === 'POST' && actionMatch) {
      const session = await requireSession(req);
      const grant = await store.getConsent(actionMatch[1]);
      if (!(await store.canAccessConsent(grant, session.identityId))) {
        throw new HttpError(404, 'not_found', 'Consent grant not found.');
      }
      const action = actionMatch[2];
      if (['accept', 'decline'].includes(action)
        && ![grant.subjectIdentityId, grant.granteeIdentityId].includes(session.identityId)) {
        throw new HttpError(403, 'forbidden', 'Only the subject or grantee may accept or decline.');
      }
      const body = await readJson(req);
      let prepared = { ...grant, status: effectiveConsentStatus(grant, new Date().toISOString()) };
      if (action === 'verify') {
        if (typeof body.verificationId !== 'string' || !body.verificationId) {
          throw new HttpError(400, 'verification_required', 'A verificationId is required.');
        }
        prepared.verificationId = body.verificationId;
      }
      if (action === 'disclose' && typeof body.scopeDisclosure === 'string') {
        prepared.scopeDisclosure = body.scopeDisclosure;
      }
      const result = transitionConsent(prepared, action, new Date().toISOString());
      if (!result.ok) throw new HttpError(409, 'invalid_transition', result.reason);
      json(res, 200, await store.saveConsent(result.grant));
      return;
    }

    const verificationMatch = path.match(/^\/verification\/([^/]+)$/);
    if (method === 'GET' && verificationMatch) {
      const session = await requireSession(req);
      const grant = await store.getConsent(verificationMatch[1]);
      if (!(await store.canAccessConsent(grant, session.identityId))) {
        throw new HttpError(404, 'not_found', 'Verification record not found.');
      }
      json(res, 200, await createVerifiableEnvelope({
        kind: 'consent',
        subject: grant.subjectIdentityId,
        issuer: grant.inviterIdentityId,
        issuedAt: grant.createdAt,
        expiresAt: grant.expiresAt,
        payload: grant,
        proofSigner: 'oneorigin-service',
      }));
      return;
    }

    if (method === 'GET' && path === '/templates') {
      const product = url.searchParams.get('product') ?? undefined;
      const kind = url.searchParams.get('kind') ?? undefined;
      json(res, 200, await store.listTemplates(product, kind));
      return;
    }

    if (method === 'POST' && path === '/templates/validate') {
      const template = await readJson(req);
      const shape = validateTemplate(template);
      const files = shape.ok ? await verifyTemplateFiles(template) : { ok: false, diagnostics: [] };
      json(res, 200, {
        ok: shape.ok && files.ok,
        diagnostics: [...shape.diagnostics, ...files.diagnostics],
      });
      return;
    }

    if (method === 'GET' && path === '/observability/health') {
      const session = await requireSession(req);
      const { grant, product } = await authorizeObservation(req, url, session);
      json(res, 200, {
        status: 'live',
        product,
        at: new Date().toISOString(),
        consentGrantId: grant.id,
        health: { ok: true, subject: grant.subjectIdentityId, categories: grant.dataCategories },
      });
      return;
    }

    if (method === 'GET' && path === '/observability/events') {
      const session = await requireSession(req);
      const { grant, product } = await authorizeObservation(req, url, session);
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write(`event: health\ndata: ${JSON.stringify({
        status: 'live', product, consentGrantId: grant.id, at: new Date().toISOString(),
      })}\n\n`);
      streams += 1;
      const timer = setInterval(() => res.write(': keep-alive\n\n'), 15_000);
      req.on('close', () => {
        clearInterval(timer);
        streams -= 1;
      });
      return;
    }

    throw new HttpError(404, 'not_found', 'Unknown endpoint.');
  }

  async function authorizeObservation(req, url, session) {
    const product = url.searchParams.get('product');
    if (product !== 'corebase' && product !== 'coreskills') {
      throw new HttpError(400, 'invalid_product', 'product must be corebase or coreskills.');
    }
    const grant = await store.getConsent(url.searchParams.get('consentGrantId') ?? '');
    if (!grant || grant.granteeIdentityId !== session.identityId || grant.application !== product) {
      throw new HttpError(403, 'no_consent', 'No active consent grant for this product.');
    }
    if (!isConsentActive(grant, new Date().toISOString())) {
      throw new HttpError(403, 'consent_inactive', 'The consent grant is not active.');
    }
    if (grant.dataCategories.includes('user-content') && !grant.userContentAuthorizationId) {
      throw new HttpError(403, 'user_content_not_authorized', 'User content requires separate authorization.');
    }
    if (!grant.operations.includes('read') && !grant.operations.includes('diagnose')) {
      throw new HttpError(403, 'no_read_operation', 'The grant does not authorize observation.');
    }
    return { grant, product };
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : 'internal_error';
      const message = error instanceof HttpError ? error.message : 'Internal server error.';
      json(res, status, { error: { code, message } });
    });
  });

  return {
    server,
    store,
    adapter,
    emailSender,
    async listen(port = Number(process.env.SERVICE_PORT ?? 8787), host = '0.0.0.0') {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await adapter.close();
    },
  };
}
