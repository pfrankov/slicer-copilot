/**
 * Minimal console logger used across the CLI.
 *
 * @param {boolean} [verbose=false]
 * @returns {{ log: (...args: any[]) => void, debug: (...args: any[]) => void }}
 */
export function createLogger(verbose = false) {
  const log = (...args) => {
    console.log(...args);
  };

  const debug = (...args) => {
    if (verbose) {
      console.log(...args);
    }
  };

  return { log, debug };
}
