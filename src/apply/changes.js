import { ensureObjectOverride } from "../utils/objectOverrides.js";
import { createI18n } from "../i18n.js";

/**
 * @typedef {object} LlmChange
 * @property {"global" | "object"} [scope]
 * @property {{ objectName?: string | null; name?: string | null; plateIndex?: number | null } | null} [target]
 * @property {string} parameter
 * @property {string | number | boolean | null} newValue
 * @property {"absolute" | "relative"} [changeType]
 * @property {string} [reason]
 */

/**
 * @typedef {object} LlmResponse
 * @property {number} [version]
 * @property {LlmChange[]} changes
 * @property {string} [globalRationale]
 * @property {string[]} [warnings]
 */

const SPEEDS_PARAMETER_PREFIX = "speeds.";

/**
 * Apply LLM-suggested changes onto a normalized project model.
 *
 * @param {object} options
 * @param {object} options.normalized Normalized project model from `parse3mfBuffer`.
 * @param {LlmResponse} options.response Validated optimizer response.
 * @param {boolean} [options.respectUserSettings=true] Protect user-modified settings listed in the project.
 * @param {{ t: (key: string, vars?: Record<string, string | number>) => string }} [options.i18n]
 * @returns {{ updated: object, warnings: string[], diffs: Array<{scope: string, target: any, parameter: string, from: any, to: any, reason: string}> }}
 */
export function applyLlmChanges({
  normalized,
  response,
  respectUserSettings = true,
  i18n,
}) {
  const translator = i18n ?? createI18n();
  const t = translator.t;
  const updated = structuredClone(normalized);
  const warnings = [...(response.warnings ?? [])];
  const diffs = [];
  const userModified = buildUserModifiedLookup(
    updated.userModifiedSettings ?? [],
  );

  for (const change of response.changes) {
    if (
      respectUserSettings &&
      isUserSettingLocked(change.parameter, userModified)
    ) {
      warnings.push(
        t("userSettingLockedWarning", { parameter: change.parameter }),
      );
      continue;
    }
    const result = applySingleChange({ updated, change, warnings, t });
    if (result) diffs.push(result);
  }

  return { updated, warnings, diffs };
}

function applySingleChange({ updated, change, warnings, t }) {
  const scope = change.scope ?? "global";
  const apply = scope === "global" ? applyGlobalChange : applyObjectChange;

  return apply({ updated, change, warnings, t });
}

function applyGlobalChange({ updated, change, warnings, t }) {
  const { globalProcess } = updated.currentSettings;
  const { currentValue, setter } = resolveParameter(
    globalProcess,
    change.parameter,
  );
  if (currentValue === undefined) {
    warnings.push(
      t("unknownParameterWarning", { parameter: change.parameter }),
    );
    return null;
  }
  const proposed = computeNewValue({ currentValue, change, warnings, t });
  if (proposed === currentValue) {
    return null;
  }
  setter(proposed);
  return formatDiff({
    change,
    from: currentValue,
    to: proposed,
    scope: "global",
    target: null,
  });
}

function applyObjectChange({ updated, change, warnings, t }) {
  const { objectName: targetName, plateIndex } = resolveObjectTarget(change);
  const plate = findPlate(
    updated.projectSummary.plates,
    targetName,
    plateIndex,
  );
  if (!plate) {
    warnings.push(
      t("objectNotFoundWarning", {
        object: targetName,
        parameter: change.parameter,
      }),
    );
    return null;
  }
  const override = ensureObjectOverride(
    updated.currentSettings.perObjectOverrides,
    { objectName: targetName, plateIndex: plate.index },
  );
  const { currentValue, setter } = resolveParameter(override, change.parameter);
  const baseValue =
    currentValue === undefined
      ? resolveParameter(
          updated.currentSettings.globalProcess,
          change.parameter,
        ).currentValue
      : currentValue;
  if (baseValue === undefined) {
    warnings.push(
      t("unknownObjectParameterWarning", {
        parameter: change.parameter,
        object: targetName,
      }),
    );
    return null;
  }
  const proposed = computeNewValue({
    currentValue: baseValue,
    change,
    warnings,
    t,
  });
  if (proposed === baseValue) {
    return null;
  }
  setter(proposed);
  syncPlateOverride({
    plate,
    objectName: targetName,
    parameter: change.parameter,
    value: proposed,
  });
  return formatDiff({
    change,
    from: baseValue,
    to: proposed,
    scope: "object",
    target: { objectName: targetName, plateIndex: plate.index },
  });
}

function syncPlateOverride({ plate, objectName, parameter, value }) {
  const obj = plate.objects.find((item) => item.name === objectName);
  /* c8 ignore next */
  if (!obj) return;
  if (!obj.settings) {
    obj.settings = {};
  }
  obj.settings[parameter] = value;
}

function resolveObjectTarget(change) {
  return {
    objectName:
      change.target?.objectName ?? change.target?.name ?? change.parameter,
    plateIndex: change.target?.plateIndex ?? null,
  };
}

function resolveParameter(container, parameter) {
  const speedKey = parseSpeedKey(parameter);
  if (speedKey !== null) {
    const currentValue = container.speeds?.[speedKey];
    return {
      currentValue,
      setter: (value) => {
        const speeds = container.speeds ? { ...container.speeds } : {};
        speeds[speedKey] = value;
        container.speeds = speeds;
      },
    };
  }
  return {
    currentValue: container[parameter],
    setter: (value) => {
      container[parameter] = value;
    },
  };
}

function parseSpeedKey(parameter) {
  if (!parameter.startsWith(SPEEDS_PARAMETER_PREFIX)) return null;
  return parameter.slice(SPEEDS_PARAMETER_PREFIX.length).split(".")[0];
}

function computeNewValue({ currentValue, change, warnings, t }) {
  if (change.changeType === "relative") {
    if (
      typeof currentValue !== "number" ||
      typeof change.newValue !== "number"
    ) {
      warnings.push(
        t("relativeChangeTypeWarning", { parameter: change.parameter }),
      );
      return currentValue;
    }
    return currentValue + currentValue * change.newValue;
  }
  return change.newValue;
}

function findPlate(plates, objectName, plateIndex) {
  return plates.find((plate) => {
    if (plateIndex !== null && plate.index !== plateIndex) return false;
    return plate.objects.some((obj) => obj.name === objectName);
  });
}

function formatDiff({ change, from, to, scope, target }) {
  return {
    scope,
    target,
    parameter: change.parameter,
    from,
    to,
    reason: change.reason ?? "",
  };
}

function buildUserModifiedLookup(userModifiedSettings) {
  const raw = new Set();
  const normalized = new Set();
  for (const entry of userModifiedSettings) {
    if (!entry) continue;
    const key = String(entry);
    raw.add(key);
    normalized.add(normalizeSettingKey(key));
  }
  return { raw, normalized };
}

function normalizeSettingKey(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isUserSettingLocked(parameter, lookup) {
  if (lookup.raw.size === 0) return false;
  if (lookup.raw.has(parameter)) return true;
  return lookup.normalized.has(normalizeSettingKey(parameter));
}
