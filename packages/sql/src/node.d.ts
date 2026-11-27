/** Minimal ambient declarations: this package intentionally has no runtime dependencies. */
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: string): string;
}
