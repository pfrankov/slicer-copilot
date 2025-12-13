function mapPlateImages(plateImages = []) {
  return plateImages
    .filter((img) => typeof img?.dataUrl === "string")
    .map((img) => ({
      plateIndex: Number.isFinite(img.plateIndex) ? img.plateIndex : null,
      name: img.name ?? "plate.png",
      dataUrl: img.dataUrl,
    }));
}

function resolvePrimaryGoal(intent) {
  const goal = intent?.primary_goal;
  if (typeof goal !== "string") return "balanced";
  const trimmed = goal.trim();
  return trimmed || "balanced";
}

function buildConstraints(constraints) {
  const maxTime = constraints?.max_print_time_hours;
  const hasMaxTime =
    typeof maxTime === "number" || (typeof maxTime === "string" && maxTime);
  const materialSaving = constraints?.material_saving_important === true;
  if (!hasMaxTime && !materialSaving) return undefined;
  return {
    ...(hasMaxTime ? { max_print_time_hours: maxTime } : {}),
    ...(materialSaving ? { material_saving_important: true } : {}),
  };
}

function setIfNonEmptyArray(target, key, value) {
  if (!Array.isArray(value) || value.length === 0) return;
  target[key] = value;
}

function setIfTrue(target, key, value) {
  if (value !== true) return;
  target[key] = true;
}

function setIfNonEmptyString(target, key, value) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  target[key] = trimmed;
}

function buildIntentDetails(intent) {
  const details = {
    primary_goal: resolvePrimaryGoal(intent),
  };

  setIfNonEmptyArray(details, "secondary_goals", intent?.secondary_goals);
  const constraints = buildConstraints(intent?.constraints);
  if (constraints) details.constraints = constraints;
  setIfTrue(details, "load_bearing", intent?.load_bearing);
  setIfTrue(details, "safety_critical", intent?.safety_critical);
  setIfNonEmptyArray(details, "locked_parameters", intent?.locked_parameters);
  setIfNonEmptyArray(details, "preferred_focus", intent?.preferred_focus);
  setIfNonEmptyString(
    details,
    "free_text_description",
    intent?.free_text_description,
  );

  return details;
}

/**
 * Build the JSON payload passed to the optimizer model.
 *
 * @param {object} options
 * @param {object} options.normalized Normalized project model from `parse3mfBuffer`.
 * @param {object | null | undefined} options.userIntent Normalized intent (or null).
 * @param {Array<{ plateIndex?: number | null; name?: string; dataUrl?: string }>} [options.plateImages]
 * @param {boolean} [options.allowUserSettingOverrides]
 * @param {string} [options.targetLanguage]
 * @returns {object}
 */
export function buildLlmRequestPayload({
  normalized,
  userIntent,
  plateImages = [],
  allowUserSettingOverrides = false,
  targetLanguage,
}) {
  const intent = userIntent ?? {};
  const plates = normalized.projectSummary.plates ?? [];
  const projectSummary = {
    fileName: normalized.fileName,
    printer: normalized.projectSummary.printer,
    filaments: normalized.projectSummary.filaments,
    base_profile: normalized.projectSummary.base_profile ?? null,
  };

  if (plates.length > 0) {
    projectSummary.plates = plates.map((plate) => ({
      index: plate.index,
      name: plate.name,
      objects: plate.objects.map((object) => ({
        name: object.name,
        plateIndex: object.plateIndex ?? plate.index,
        geometry: object.geometry ?? null,
      })),
    }));
  }

  return {
    version: 1,
    projectSummary,
    currentSettings: normalized.currentSettings,
    userModifiedSettings: normalized.userModifiedSettings ?? [],
    intentDetails: buildIntentDetails(intent),
    plateImages: mapPlateImages(plateImages),
    allowUserSettingOverrides: allowUserSettingOverrides === true,
    targetLanguage: normalizeLanguage(targetLanguage),
  };
}
import { normalizeLanguage } from "../i18n.js";
