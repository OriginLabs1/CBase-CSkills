import { describe, expect, it } from 'vitest';
import { plainClone } from '../src/lib/storage';

describe('plainClone', () => {
  it('turns reactive-style nested data into structured-clone-safe values', () => {
    const lines = new Proxy(
      [{ id: '1', text: 'help' }],
      { get: (target, key) => Reflect.get(target, key) },
    );
    const session = new Proxy(
      { id: 's1', lines, history: ['help'] },
      { get: (target, key) => Reflect.get(target, key) },
    );

    const cloned = plainClone(session);

    expect(cloned).toEqual({ id: 's1', lines: [{ id: '1', text: 'help' }], history: ['help'] });
    expect(() => structuredClone(cloned)).not.toThrow();
  });
});
