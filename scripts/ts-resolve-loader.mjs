/**
 * Minimal Node loader for the optional service: workspace packages publish
 * TypeScript source whose relative imports use `.js` specifiers. Native type
 * stripping handles the syntax; this loader resolves those specifiers to the
 * `.ts` files that actually exist. No runtime dependencies are required.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || !specifier.endsWith('.js')) {
      throw error;
    }
    return nextResolve(specifier.slice(0, -3) + '.ts', context);
  }
}
