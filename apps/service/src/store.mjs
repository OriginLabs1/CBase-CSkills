import { randomId } from '@oneorigin/contracts';
import {
  EMAIL_CREDENTIAL_SCHEMA,
  IDENTITY_SCHEMA,
  hashIdentityId,
} from '@oneorigin/identity';
import { createChallengeState, freshIdentityMaterial } from './otp.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Domain operations over the shared PersistenceAdapter contract. */
export class DomainStore {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getJson(namespace, key) {
    const bytes = await this.adapter.get(namespace, key);
    return bytes ? JSON.parse(decoder.decode(bytes)) : undefined;
  }

  async putJson(namespace, key, value) {
    await this.adapter.put(namespace, key, encoder.encode(JSON.stringify(value)));
    return value;
  }

  async deleteJson(namespace, key) {
    await this.adapter.delete(namespace, key);
  }

  async findIdentityByEmailHash(emailHash) {
    const identityId = await this.getJson('credentials', `index:${emailHash}`);
    if (!identityId) return undefined;
    return this.getJson('identities', identityId);
  }

  /** Creates the provider-independent identity on first verified email only. */
  async getOrCreateIdentity(emailHash, issuer = 'oneorigin') {
    const existing = await this.findIdentityByEmailHash(emailHash);
    if (existing) return existing;
    const now = new Date().toISOString();
    const identity = {
      schema: IDENTITY_SCHEMA,
      id: await hashIdentityId(freshIdentityMaterial()),
      createdAt: now,
      issuer,
    };
    const credential = {
      schema: EMAIL_CREDENTIAL_SCHEMA,
      id: randomId(),
      identityId: identity.id,
      emailHash,
      verifiedAt: now,
      issuer,
      method: 'email-otp',
    };
    await this.putJson('identities', identity.id, identity);
    await this.putJson('credentials', credential.id, credential);
    await this.putJson('credentials', `index:${emailHash}`, identity.id);
    return identity;
  }

  async createChallenge(emailHash, code) {
    const challenge = createChallengeState(emailHash, randomId(), code);
    await this.putJson('verifications', `challenge:${challenge.id}`, challenge);
    return challenge;
  }

  async getChallenge(id) {
    return this.getJson('verifications', `challenge:${id}`);
  }

  async saveChallenge(challenge) {
    return this.putJson('verifications', `challenge:${challenge.id}`, challenge);
  }

  async saveSession(session) {
    return this.putJson('sessions', session.id, session);
  }

  async getSession(id) {
    const session = await this.getJson('sessions', id);
    if (!session) return undefined;
    if (session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) return undefined;
    return session;
  }

  async revokeSession(id) {
    const session = await this.getJson('sessions', id);
    if (!session) return;
    await this.putJson('sessions', id, { ...session, revokedAt: new Date().toISOString() });
  }

  async saveConsent(grant) {
    return this.putJson('consents', grant.id, grant);
  }

  async getConsent(id) {
    return this.getJson('consents', id);
  }

  async canAccessConsent(grant, identityId) {
    if (!grant) return false;
    return [grant.subjectIdentityId, grant.granteeIdentityId, grant.inviterIdentityId].includes(identityId);
  }

  async listConsentsFor(identityId) {
    const keys = await this.adapter.list('consents');
    const grants = await Promise.all(keys.map((key) => this.getJson('consents', key)));
    return grants.filter(Boolean).filter((grant) => this.canAccessConsent(grant, identityId));
  }

  async listMemberships(identityId) {
    const keys = await this.adapter.list('memberships');
    const memberships = await Promise.all(keys.map((key) => this.getJson('memberships', key)));
    return memberships.filter(Boolean).filter((membership) => membership.identityId === identityId);
  }

  async saveTemplate(template) {
    return this.putJson('templates', template.id, template);
  }

  async listTemplates(product, kind) {
    const keys = await this.adapter.list('templates');
    const templates = await Promise.all(keys.map((key) => this.getJson('templates', key)));
    return templates.filter(Boolean).filter((template) =>
      (!product || template.product === product) && (!kind || template.kind === kind));
  }

  async getProfile(identityId) {
    return this.getJson('profiles', identityId);
  }
}
