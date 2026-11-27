import type { Template } from '@oneorigin/templates';
import type {
  ConsentAction,
  ConsentActionBody,
  ConsentGrant,
  IdentityStatus,
  ObservabilitySnapshot,
  RequestCodeResult,
  ServiceConfig,
  Session,
} from './types.js';

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** Talks to the optional service. Guest mode never constructs or calls it. */
const DEFAULT_TIMEOUT_MS = 5000;

export class ServiceClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: ServiceConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'http://localhost:8787').replace(/\/+$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : undefined;
      if (!response.ok) {
        const error = body?.error;
        throw new ServiceError(response.status, error?.code ?? 'request_failed', error?.message ?? `Request failed (${response.status}).`);
      }
      return body as T;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async health(): Promise<{ ok: boolean; version: string }> {
    return this.request('/health');
  }

  async requestEmailCode(email: string): Promise<RequestCodeResult> {
    return this.request('/auth/email/request', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async verifyEmailCode(challengeId: string, code: string): Promise<Session> {
    return this.request('/auth/email/verify', { method: 'POST', body: JSON.stringify({ challengeId, code }) });
  }

  async getSession(): Promise<Session> {
    return this.request('/auth/session');
  }

  async refreshSession(): Promise<Session> {
    return this.request('/auth/session/refresh', { method: 'POST' });
  }

  async revokeSession(): Promise<void> {
    await this.request('/auth/session/revoke', { method: 'POST' });
  }

  async status(): Promise<IdentityStatus | null> {
    try {
      const session = await this.getSession();
      return { mode: 'connected', identityId: session.identityId, session };
    } catch (error) {
      if (error instanceof ServiceError && error.status === 401) return null;
      throw error;
    }
  }

  async listMemberships(): Promise<Array<Record<string, unknown>>> {
    return this.request('/memberships');
  }

  async listConsentGrants(): Promise<ConsentGrant[]> {
    return this.request('/consent-grants');
  }

  async createConsentGrant(grant: ConsentGrant): Promise<ConsentGrant> {
    return this.request('/consent-grants', { method: 'POST', body: JSON.stringify(grant) });
  }

  async consentAction(id: string, action: ConsentAction, body: ConsentActionBody = {}): Promise<ConsentGrant> {
    return this.request(`/consent-grants/${encodeURIComponent(id)}/${action}`, {
      method: 'POST', body: JSON.stringify(body),
    });
  }

  async getVerification(id: string): Promise<Record<string, unknown>> {
    return this.request(`/verification/${encodeURIComponent(id)}`);
  }

  async listTemplates(product?: string, kind?: string): Promise<Template[]> {
    const params = new URLSearchParams();
    if (product) params.set('product', product);
    if (kind) params.set('kind', kind);
    const suffix = params.size ? `?${params}` : '';
    return this.request(`/templates${suffix}`);
  }

  async validateTemplate(template: Template): Promise<{ ok: boolean; diagnostics: Array<{ code: string; severity: string; path: string; message: string }> }> {
    return this.request('/templates/validate', { method: 'POST', body: JSON.stringify(template) });
  }

  async observabilityHealth(product: 'corebase' | 'coreskills', consentGrantId: string): Promise<ObservabilitySnapshot> {
    const params = new URLSearchParams({ product, consentGrantId });
    return this.request(`/observability/health?${params}`);
  }
}
