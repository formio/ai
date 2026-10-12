/**
 * Block the calling thread for `ms` milliseconds.
 *
 * For the synchronous file writers only — the CLI and the tools share them — where a
 * short, bounded wait between attempts is the whole point and there is no event loop
 * work to yield to.
 */
export const pauseSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
