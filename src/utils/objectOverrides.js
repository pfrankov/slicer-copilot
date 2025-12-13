/**
 * Build a stable key for per-object overrides.
 *
 * Format:
 * - `${plateIndex}::${objectName}` when `plateIndex` is known
 * - `${objectName}` when `plateIndex` is `null`/`undefined`
 *
 * @param {string | null | undefined} objectName
 * @param {number | null | undefined} plateIndex
 * @returns {string}
 */
export function makeObjectKey(objectName, plateIndex) {
  const name = objectName ?? "object";
  return plateIndex == null ? name : `${plateIndex}::${name}`;
}

/**
 * Read an object override by key parts.
 *
 * @param {Record<string, any>} overrides
 * @param {{ objectName: string, plateIndex: number | null }} target
 * @returns {any}
 */
export function readObjectOverride(overrides, { objectName, plateIndex }) {
  return overrides[makeObjectKey(objectName, plateIndex)];
}

/**
 * Ensure an override object exists for the given target and return it.
 *
 * @param {Record<string, any>} overrides
 * @param {{ objectName: string, plateIndex: number | null }} target
 * @returns {Record<string, any>}
 */
export function ensureObjectOverride(overrides, { objectName, plateIndex }) {
  const key = makeObjectKey(objectName, plateIndex);
  if (!overrides[key]) {
    overrides[key] = { plateIndex, objectName };
  }
  return overrides[key];
}
