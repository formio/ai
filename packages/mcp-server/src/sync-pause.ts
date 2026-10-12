/**
 * Block the calling thread for `ms` milliseconds.
 *
 * For synchronous waits only: the CLI's wait for a file lock (BLOCKING_SLEEP), where
 * there is no event loop work to yield to, and the brief retry of a rename Windows
 * refuses for a moment. The MCP server waits for a lock on a timer (TIMER_SLEEP).
 */
export const pauseSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
