/**
 * F-11: a failed read must never look like an empty account. Pages call this
 * after loading and let the error boundary render a recoverable state.
 */
export function assertRead(
  results: { error: { message: string } | null }[],
  context: string
): void {
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error(`Failed to load ${context}: ${failed.error.message}`);
  }
}
