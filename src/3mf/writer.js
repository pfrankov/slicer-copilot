import fs from "fs";
import {
  ALLOWED_EXTRA_CONFIG_KEYS,
  GLOBAL_PROCESS_MAPPINGS,
  SPEED_MAPPINGS,
} from "./configMapping.js";
import { readObjectOverride } from "../utils/objectOverrides.js";

const MAPPED_TARGET_KEYS = new Set(
  GLOBAL_PROCESS_MAPPINGS.map((mapping) => mapping.targetKey),
);
const MAPPED_CONFIG_KEYS = new Set([
  ...GLOBAL_PROCESS_MAPPINGS.map((mapping) => mapping.configKey),
  ...SPEED_MAPPINGS.map((mapping) => mapping.configKey),
  "brim_width",
  "raft_layers",
]);

/**
 * Write an updated `.3mf` archive.
 *
 * Preserves all unknown ZIP entries; only `metadata.json` (and an optional
 * `project_settings.config`) are rewritten.
 *
 * @param {object} project
 * @param {any} project.zip JSZip instance for the archive.
 * @param {string | null} project.metadataPath
 * @param {object} project.metadata
 * @param {string | null} [project.configPath]
 * @param {object | null} [project.configData]
 * @param {object} [project.normalized]
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
export async function write3mf(
  { zip, metadataPath, metadata, configPath, configData, normalized },
  outputPath,
) {
  const targetPath = metadataPath ?? "metadata.json";
  zip.file(targetPath, JSON.stringify(metadata, null, 2));
  if (configPath) {
    const updatedConfig = buildConfigFromNormalized(
      configData ?? {},
      normalized,
    );
    zip.file(configPath, JSON.stringify(updatedConfig, null, 2));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Update the `metadata.json` structure from the normalized model.
 *
 * @param {object} metadata
 * @param {object} normalized
 * @returns {object}
 */
export function updateMetadataFromNormalized(metadata, normalized) {
  const next = { ...metadata };
  next.settings = { ...normalized.currentSettings.globalProcess };
  if (normalized.projectSummary.plates.length > 0) {
    next.plates = normalized.projectSummary.plates.map((plate) => ({
      index: plate.index,
      name: plate.name,
      objects: plate.objects.map((object) => ({
        name: object.name,
        bounding_box_mm: object.geometry?.bounding_box_mm,
        geometry: object.geometry,
        settings: readObjectOverride(
          normalized.currentSettings.perObjectOverrides,
          { objectName: object.name, plateIndex: plate.index },
        ),
      })),
    }));
  }
  next.quality_preset =
    normalized.projectSummary.base_profile ?? metadata.quality_preset;
  next.printer = normalized.projectSummary.printer;
  next.filaments = normalized.projectSummary.filaments;
  return next;
}

function buildConfigFromNormalized(base, normalized) {
  const cfg = { ...base };
  const gp = normalized.currentSettings.globalProcess;
  const touchedKeys = new Set();

  applyGlobalProcessConfig({
    cfg,
    gp,
    projectSummary: normalized.projectSummary,
    touchedKeys,
  });
  applySpeedConfig({ cfg, speeds: gp.speeds, touchedKeys });
  applyAdditionalConfig({ cfg, gp, touchedKeys });

  cfg.different_settings_to_system = updateDifferentSettingsToSystem({
    existing: cfg.different_settings_to_system,
    base,
    updated: cfg,
    touchedKeys,
  });
  return cfg;
}

function applyGlobalProcessConfig({ cfg, gp, projectSummary, touchedKeys }) {
  GLOBAL_PROCESS_MAPPINGS.forEach((mapping) => {
    const value = gp?.[mapping.targetKey];
    if (value === undefined) return;
    const formatted = mapping.serialize(value);
    if (formatted === undefined || formatted === null) return;
    const setter =
      mapping.mode === "shaped" ? setShapedConfigValue : setDirectConfigValue;
    setter({ cfg, touchedKeys, key: mapping.configKey, value: formatted });
  });

  writeAdhesionToConfig({ cfg, adhesionType: gp.adhesion_type, touchedKeys });
  writePrinterAndFilament({
    cfg,
    projectSummary,
    touchedKeys,
  });
}

function setShapedConfigValue({ cfg, touchedKeys, key, value }) {
  cfg[key] = setConfigValue(cfg[key], value);
  touchedKeys.add(key);
}

function setDirectConfigValue({ cfg, touchedKeys, key, value }) {
  if (value === undefined || value === null) return;
  cfg[key] = value;
  touchedKeys.add(key);
}

function applySpeedConfig({ cfg, speeds, touchedKeys }) {
  SPEED_MAPPINGS.forEach(({ speedKey, configKey }) => {
    const value = speeds?.[speedKey];
    if (value === undefined) return;
    cfg[configKey] = setConfigValue(cfg[configKey], value);
    touchedKeys.add(configKey);
  });
}

function applyAdditionalConfig({ cfg, gp, touchedKeys }) {
  Object.entries(gp ?? {}).forEach(([key, value]) => {
    if (MAPPED_TARGET_KEYS.has(key)) return;
    if (MAPPED_CONFIG_KEYS.has(key)) return;
    if (!allowedExtraKey(key)) return;
    if (key === "speeds" || key === "adhesion_type") return;
    if (value === undefined || value === null) return;
    cfg[key] = setConfigValue(cfg[key], value);
    touchedKeys.add(key);
  });
}

function allowedExtraKey(key) {
  return ALLOWED_EXTRA_CONFIG_KEYS.has(key);
}

function writeAdhesionToConfig({ cfg, adhesionType, touchedKeys }) {
  setDirectConfigValue({
    cfg,
    touchedKeys,
    key: "brim_width",
    value: adhesionType === "brim" ? (cfg.brim_width ?? "5") : "0",
  });
  setDirectConfigValue({
    cfg,
    touchedKeys,
    key: "raft_layers",
    value: adhesionType === "raft" ? (cfg.raft_layers ?? "1") : "0",
  });
}

function writePrinterAndFilament({ cfg, projectSummary, touchedKeys }) {
  const nozzleDiameter = projectSummary.printer.nozzle_diameter_mm;
  if (nozzleDiameter != null) {
    cfg.nozzle_diameter = [nozzleDiameter.toString()];
    touchedKeys.add("nozzle_diameter");
  }
  const filamentFamily = projectSummary.filaments[0]?.material_family;
  if (filamentFamily) {
    cfg.filament_type = [filamentFamily];
    touchedKeys.add("filament_type");
  }
  const baseProfile = projectSummary.base_profile ?? cfg.default_print_profile;
  if (baseProfile !== undefined) {
    cfg.default_print_profile = baseProfile;
    touchedKeys.add("default_print_profile");
  }
}

const DIFFERENT_SETTINGS_GROUP_KEYS = {
  print: new Set([
    "layer_height",
    "initial_layer_print_height",
    "wall_loops",
    "top_shell_layers",
    "bottom_shell_layers",
    "sparse_infill_density",
    "sparse_infill_pattern",
    "outer_wall_speed",
    "inner_wall_speed",
    "sparse_infill_speed",
    "initial_layer_speed",
    "enable_support",
    "brim_width",
    "raft_layers",
    "default_print_profile",
  ]),
  filament: new Set([
    "compatible_printers",
    "eng_plate_temp",
    "hot_plate_temp",
    "fan_max_speed",
    "first_x_layer_fan_speed",
    "nozzle_temperature",
    "nozzle_temperature_initial_layer",
    "filament_type",
  ]),
  printer: new Set(["printer_model", "nozzle_diameter"]),
};

function updateDifferentSettingsToSystem({
  existing,
  base,
  updated,
  touchedKeys,
}) {
  const groups = parseDifferentSettingsToSystem(existing);
  const merged = groups.map((items) => new Set(items));
  const existingIndexByKey = buildExistingIndexByKey(groups);

  for (const key of touchedKeys) {
    if (key === "different_settings_to_system") continue;
    if (areConfigValuesEqual(base?.[key], updated?.[key])) continue;
    const groupIndex = resolveDifferentSettingsGroupIndex(
      key,
      existingIndexByKey,
    );
    merged[groupIndex].add(key);
  }

  if (merged[1].size > 0) {
    merged[1].add("compatible_printers");
  }

  return merged.map(formatDifferentSettingsGroup);
}

function parseDifferentSettingsToSystem(existing) {
  const arr = Array.isArray(existing) ? existing : [];
  const groups = [];
  for (let index = 0; index < 3; index += 1) {
    const raw = typeof arr[index] === "string" ? arr[index] : "";
    const keys = raw
      .split(";")
      .map((k) => k.trim())
      .filter(Boolean);
    groups.push(keys);
  }
  return groups;
}

function buildExistingIndexByKey(groups) {
  const indexByKey = new Map();
  groups.forEach((keys, index) => {
    keys.forEach((key) => indexByKey.set(key, index));
  });
  return indexByKey;
}

function resolveDifferentSettingsGroupIndex(key, existingIndexByKey) {
  const existing = existingIndexByKey.get(key);
  if (existing != null) return existing;
  if (DIFFERENT_SETTINGS_GROUP_KEYS.print.has(key)) return 0;
  if (DIFFERENT_SETTINGS_GROUP_KEYS.filament.has(key)) return 1;
  if (DIFFERENT_SETTINGS_GROUP_KEYS.printer.has(key)) return 2;
  return 0;
}

function formatDifferentSettingsGroup(keys) {
  if (keys.size === 0) return "";
  return [...keys].sort().join(";");
}

function areConfigValuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }
  return a === b;
}

function setConfigValue(existing, value) {
  if (value === undefined || value === null) return existing;
  const asString = value.toString();
  if (Array.isArray(existing)) {
    if (existing.length === 0) return [asString];
    return existing.map(() => asString);
  }
  return asString;
}
