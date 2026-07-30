/**
 * Image Pipeline mock facade — single import surface for the hooks.
 * Batch 2 replaces the body of each hook with `apiFetch`; this barrel and its
 * function signatures are the seam.
 */
export * from './pipeline'
export { state as mockPipelineState, MOCK_OWNER_ID } from './store'

/** Maps internal error codes thrown by the mock facade to plain-English copy. */
export function pipelineErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : ''
  switch (code) {
    case 'INSUFFICIENT_CREDITS':
      return 'You don’t have enough credits for this step. Request more from the Credits page.'
    case 'TOO_MANY_IN_FLIGHT':
      return 'You already have 3 generations in progress. Finish or reject one first.'
    case 'NO_INPUT':
      return 'Add a reference image or a prompt to start a generation.'
    case 'FLOW_WORKER_OFFLINE':
      return 'The Flow desktop channel is offline right now. Use the API channel instead.'
    default:
      return 'Something needs another try — please retry.'
  }
}
