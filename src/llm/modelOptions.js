import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TEMPERATURE,
  FALLBACK_MATERIAL_LIMITS,
  LAYER_HEIGHT_MIN_MM,
  LAYER_HEIGHT_NOZZLE_RATIO_MAX,
  MATERIAL_LIMITS,
  DEFAULT_NOZZLE_DIAMETER_MM,
} from "../constants.js";

export const REASONING_EFFORT_VALUES = ["low", "medium", "high"];

/**
 * @param {string | undefined} model
 * @returns {boolean}
 */
export function modelSupportsReasoning(model) {
  if (typeof model !== "string" || !model.trim()) return false;
  const normalized = model.trim().toLowerCase();
  return (
    normalized.includes("-sol") ||
    /^o[0-9]/.test(normalized) ||
    /gpt-[56]/.test(normalized) ||
    normalized.includes("reasoning")
  );
}

/**
 * @param {string | undefined} value
 * @returns {"low" | "medium" | "high" | undefined}
 */
export function resolveReasoningEffort(value) {
  if (value === "none" || value === "off" || value === "") return undefined;
  const effort = (value ?? DEFAULT_REASONING_EFFORT).trim().toLowerCase();
  if (!REASONING_EFFORT_VALUES.includes(effort)) {
    throw new Error(
      `Invalid reasoning effort "${value}". Use: ${REASONING_EFFORT_VALUES.join(", ")}, or "none".`,
    );
  }
  return effort;
}

/**
 * @param {object} config
 * @param {string} config.model
 * @param {number} config.temperature
 * @param {"low" | "medium" | "high" | undefined} [config.reasoningEffort]
 * @returns {object}
 */
export function buildChatCompletionBody(config) {
  const body = {
    model: config.model ?? DEFAULT_MODEL,
  };
  const effort = config.reasoningEffort;
  if (effort && modelSupportsReasoning(body.model)) {
    body.reasoning_effort = effort;
  } else {
    body.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  }
  return body;
}

/**
 * @param {object} normalized
 * @returns {object}
 */
export function buildOptimizationContext(normalized) {
  const printer = normalized?.projectSummary?.printer ?? {};
  const nozzle =
    typeof printer.nozzle_diameter_mm === "number"
      ? printer.nozzle_diameter_mm
      : DEFAULT_NOZZLE_DIAMETER_MM;
  const families = [
    ...new Set(
      (normalized?.projectSummary?.filaments ?? [])
        .map((filament) => filament?.material_family)
        .filter((family) => typeof family === "string" && family.trim()),
    ),
  ];
  const materialSafeRanges = {};
  for (const family of families) {
    materialSafeRanges[family] =
      MATERIAL_LIMITS[family] ?? FALLBACK_MATERIAL_LIMITS;
  }
  if (Object.keys(materialSafeRanges).length === 0) {
    materialSafeRanges.default = FALLBACK_MATERIAL_LIMITS;
  }
  return {
    nozzle_diameter_mm: nozzle,
    layer_height_mm_range: [
      LAYER_HEIGHT_MIN_MM,
      Number((nozzle * LAYER_HEIGHT_NOZZLE_RATIO_MAX).toFixed(3)),
    ],
    material_safe_ranges: materialSafeRanges,
  };
}

/**
 * @param {object | undefined} intentDetails
 * @returns {"low" | "high"}
 */
export function plateImageDetailLevel(intentDetails) {
  const goal = intentDetails?.primary_goal ?? "balanced";
  if (goal === "draft_fast") return "low";
  return "high";
}
