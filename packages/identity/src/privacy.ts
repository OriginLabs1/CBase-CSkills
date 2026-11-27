import type { ProgrammerProfile } from './types.js';

export type ViewerClass = 'public' | 'member' | 'self';

export interface PublicProfileView {
  identityId: string;
  handle: string;
  displayName?: string;
  bio?: string;
  links?: string[];
  updatedAt?: string;
}

/**
 * Minimal profile projection. Credential fields never enter this view, and
 * `self` visibility hides details from everybody except the identity owner.
 */
export function profileForViewer(profile: ProgrammerProfile, viewer: ViewerClass): PublicProfileView {
  const base: PublicProfileView = { identityId: profile.identityId, handle: profile.handle };
  if (viewer === 'self') {
    return { ...base, displayName: profile.displayName, bio: profile.bio, links: profile.links, updatedAt: profile.updatedAt };
  }
  if (profile.visibility === 'self') return base;
  const view: PublicProfileView = { ...base, displayName: profile.displayName, updatedAt: profile.updatedAt };
  if (profile.visibility === 'public' || viewer === 'member') {
    if (profile.bio !== undefined) view.bio = profile.bio;
    if (profile.links !== undefined) view.links = [...profile.links];
  }
  return view;
}

/** Defensive check used before serializing any profile-derived payload. */
export function containsPrivateField(value: unknown): boolean {
  const forbidden = /^(email|emailHash|password|secret|token|credential|code|codeHash)$/i;
  const walk = (input: unknown): boolean => {
    if (Array.isArray(input)) return input.some(walk);
    if (typeof input !== 'object' || input === null) return false;
    return Object.entries(input).some(([key, child]) => forbidden.test(key) || walk(child));
  };
  return walk(value);
}
