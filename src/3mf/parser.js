import fs from "fs";
import JSZip from "jszip";
import {
  DEFAULT_GLOBAL_PROCESS,
  DEFAULT_NOZZLE_DIAMETER_MM,
  DEFAULT_SPEEDS,
} from "../constants.js";
import { FileFormatError } from "../errors.js";
import { mapConfigToSettings, numberOrNull } from "./configMapping.js";
import { makeObjectKey } from "../utils/objectOverrides.js";

const METADATA_CANDIDATES = [
  "BambuStudio/metadata.json",
  "Metadata/metadata.json",
  "metadata.json",
];

/**
 * @typedef {object} PlateImage
 * @property {number | null} plateIndex Zero-based plate index when known.
 * @property {string} name File name within the archive.
 * @property {string} dataUrl `data:image/png;base64,...` URL for vision input.
 */

/**
 * @typedef {object} Parsed3mf
 * @property {string} fileName
 * @property {any} zip JSZip instance for the archive.
 * @property {string | null} metadataPath
 * @property {object} metadata
 * @property {string | null} configPath
 * @property {object | null} configData
 * @property {PlateImage[]} plateImages
 * @property {object} normalized Normalized project/settings model for optimization.
 */

/**
 * Parse a `.3mf` (ZIP) project from disk.
 *
 * @param {string} filePath
 * @returns {Promise<Parsed3mf>}
 */
export async function parse3mfFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return parse3mfBuffer(buffer, filePath);
}

/**
 * Parse a `.3mf` (ZIP) project from an in-memory buffer.
 *
 * @param {Buffer} buffer
 * @param {string} [fileName]
 * @returns {Promise<Parsed3mf>}
 */
export async function parse3mfBuffer(buffer, fileName = "project.3mf") {
  const zip = await JSZip.loadAsync(buffer);
  const metadataPath = await findMetadataPath(zip);
  const metadataRaw = metadataPath ? await readJson(zip, metadataPath) : null;
  const metadata =
    metadataRaw && typeof metadataRaw === "object" ? metadataRaw : {};
  const { configPath, configData } = await mergeConfigFromZip(
    zip,
    metadata,
    metadataPath,
  );
  const plateImages = await collectPlateImages(zip);
  const normalized = buildNormalized(metadata, fileName, configData);

  return {
    fileName,
    zip,
    metadataPath,
    metadata,
    configPath,
    configData,
    plateImages,
    normalized,
  };
}

async function findMetadataPath(zip) {
  for (const candidate of METADATA_CANDIDATES) {
    if (zip.file(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function readJson(zip, entryPath) {
  const file = zip.file(entryPath);
  if (!file) {
    /* c8 ignore next */
    return {};
  }
  const content = await file.async("string");
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new FileFormatError({
      path: entryPath,
      message: `Failed to parse JSON at ${entryPath}: ${error.message}`,
    });
  }
}

async function mergeConfigFromZip(zip, metadata, metadataPath) {
  const candidates = findConfigCandidates(zip, metadataPath);
  if (candidates.length === 0) {
    return { configPath: null, configData: null };
  }
  for (const configPath of candidates) {
    const config = await readJson(zip, configPath);
    if (!config || typeof config !== "object") continue;
    if (!isConfigUseful(config)) continue;

    applyConfig(metadata, config);
    return { configPath, configData: config };
  }
  return { configPath: null, configData: null };
}

function findConfigCandidates(zip, metadataPath) {
  return Object.keys(zip.files).filter((name) => {
    if (metadataPath && name === metadataPath) return false;
    const lower = name.toLowerCase();
    const isJson = lower.endsWith(".json") || lower.endsWith(".config");
    const looksConfig =
      lower.includes("config") ||
      lower.includes("setting") ||
      lower.includes("profile") ||
      lower.includes("project") ||
      lower.includes("preset");
    return isJson && looksConfig;
  });
}

function isConfigUseful(config) {
  return (
    config.printer_model ||
    config.default_print_profile ||
    config.nozzle_diameter ||
    config.filament_type ||
    config.layer_height ||
    config.initial_layer_print_height ||
    config.different_settings_to_system ||
    config.curr_bed_type
  );
}

function applyConfig(metadata, config) {
  metadata.printer = metadata.printer ?? {};
  metadata.printer.name = config.printer_model ?? metadata.printer.name;
  metadata.printer.nozzle_diameter_mm =
    numberOrNull(config.nozzle_diameter?.[0]) ??
    metadata.printer.nozzle_diameter_mm;
  metadata.printer.bed_type = config.curr_bed_type ?? metadata.printer.bed_type;

  const filamentType = config.filament_type?.[0];
  const material_family = mapMaterialFamily(filamentType);
  // Prefer filament_settings_id (e.g., "Bambu PETG HF @BBL H2S") over vendor+type
  // This preserves critical info like "HF" (High Flow) variants
  const filamentSettingsId = config.filament_settings_id?.[0];
  const filamentName =
    filamentSettingsId ||
    [config.filament_vendor, filamentType].filter(Boolean).join(" ").trim() ||
    "Unknown filament";

  if (metadata.filaments && metadata.filaments.length > 0) {
    // Update existing filaments with better name from config if available
    if (filamentSettingsId) {
      metadata.filaments[0].name = filamentSettingsId;
    }
    if (material_family && material_family !== "Other") {
      metadata.filaments[0].material_family = material_family;
    }
  } else {
    metadata.filaments = [
      {
        id: "0",
        name: filamentName,
        material_family,
        color: config.filament_colour?.[0],
        nozzle_temp_recommended_range_c: [
          numberOrNull(config.nozzle_temperature_range_low?.[0]),
          numberOrNull(config.nozzle_temperature_range_high?.[0]),
        ].filter((v) => v !== null),
      },
    ];
  }

  metadata.quality_preset =
    config.default_print_profile ?? metadata.quality_preset ?? null;
  const settings = metadata.settings ?? {};
  metadata.settings = mapConfigToSettings({ config, baseSettings: settings });
}

function mapMaterialFamily(type) {
  if (!type) return "Other";
  const upper = String(type).toUpperCase();
  if (upper.includes("PLA")) return "PLA";
  if (upper.includes("PETG")) return "PETG";
  if (upper.includes("ABS")) return "ABS";
  if (upper.includes("ASA")) return "ASA";
  if (upper.includes("TPU")) return "TPU";
  if (upper.includes("NYLON")) return "Nylon";
  if (upper.includes("PC")) return "PC";
  return "Other";
}

function buildNormalized(metadata, fileName, configData) {
  const printer = metadata.printer ?? {};
  const filaments = metadata.filaments ?? [];
  const plates = buildPlates(metadata);
  const settings = metadata.settings ?? {};
  const globalProcess = buildGlobalProcess(settings);
  const perObjectOverrides = collectOverrides(plates);
  const userModifiedSettings = extractUserModifiedSettings(configData);

  return {
    fileName,
    projectSummary: {
      fileName,
      printer: {
        name: printer.name ?? "Unknown printer",
        nozzle_diameter_mm:
          printer.nozzle_diameter_mm ?? DEFAULT_NOZZLE_DIAMETER_MM,
        bed_size_mm: printer.bed_size_mm,
        bed_type: printer.bed_type,
      },
      filaments: filaments.map((f, index) => ({
        id: f.id ?? String(index),
        name: f.name ?? "Unknown filament",
        material_family: f.material_family ?? "Other",
        color: f.color,
        nozzle_temp_recommended_range_c: f.nozzle_temp_recommended_range_c,
        bed_temp_recommended_range_c: f.bed_temp_recommended_range_c,
      })),
      base_profile: metadata.quality_preset ?? metadata.base_profile ?? null,
      plates,
    },
    currentSettings: {
      globalProcess,
      perObjectOverrides,
    },
    userModifiedSettings,
  };
}

/**
 * Extract user-modified settings from different_settings_to_system.
 * This array indicates which settings the user has changed from the base profile.
 *
 * @param {object | null} configData
 * @returns {string[]}
 */
function extractUserModifiedSettings(configData) {
  const different = configData?.different_settings_to_system;
  if (!Array.isArray(different)) return [];

  const allKeys = [];
  for (const group of different) {
    if (typeof group !== "string") continue;
    const keys = group
      .split(";")
      .map((k) => k.trim())
      .filter(Boolean);
    allKeys.push(...keys);
  }
  return [...new Set(allKeys)];
}

async function collectPlateImages(zip) {
  const plateEntries = Object.keys(zip.files).filter((name) =>
    /metadata\/plate_\d+\.png$/i.test(name),
  );
  const unique = new Map();
  for (const entryPath of plateEntries) {
    const match = entryPath.match(/plate_(\d+)\.png$/i);
    const plateIndex = match ? Number.parseInt(match[1], 10) - 1 : null;
    const file = zip.file(entryPath);
    if (!file) continue;
    const base64 = await file.async("base64");
    const dataUrl = `data:image/png;base64,${base64}`;
    unique.set(entryPath, {
      plateIndex: Number.isFinite(plateIndex) ? plateIndex : null,
      name: entryPath.split("/").pop() ?? entryPath,
      dataUrl,
    });
  }
  return Array.from(unique.values());
}

function buildGlobalProcess(settings) {
  const base = { ...settings };
  const speeds = settings.speeds
    ? { ...DEFAULT_SPEEDS, ...settings.speeds }
    : { ...DEFAULT_SPEEDS };

  return {
    ...base,
    layer_height_mm: withDefault(
      settings.layer_height_mm,
      DEFAULT_GLOBAL_PROCESS.layer_height_mm,
    ),
    first_layer_height_mm: withDefault(
      settings.first_layer_height_mm ?? settings.layer_height_mm,
      DEFAULT_GLOBAL_PROCESS.first_layer_height_mm,
    ),
    wall_line_count: withDefault(
      settings.wall_line_count,
      DEFAULT_GLOBAL_PROCESS.wall_line_count,
    ),
    top_layers: withDefault(
      settings.top_layers,
      DEFAULT_GLOBAL_PROCESS.top_layers,
    ),
    bottom_layers: withDefault(
      settings.bottom_layers,
      DEFAULT_GLOBAL_PROCESS.bottom_layers,
    ),
    infill_density_percent: withDefault(
      settings.infill_density_percent,
      DEFAULT_GLOBAL_PROCESS.infill_density_percent,
    ),
    infill_pattern:
      settings.infill_pattern ?? DEFAULT_GLOBAL_PROCESS.infill_pattern,
    nozzle_temp_c: withDefault(
      settings.nozzle_temp_c,
      DEFAULT_GLOBAL_PROCESS.nozzle_temp_c,
    ),
    bed_temp_c: withDefault(
      settings.bed_temp_c,
      DEFAULT_GLOBAL_PROCESS.bed_temp_c,
    ),
    fan_speed_percent: withDefault(
      settings.fan_speed_percent,
      DEFAULT_GLOBAL_PROCESS.fan_speed_percent,
    ),
    first_layers_fan_percent: withDefault(
      settings.first_layers_fan_percent ?? settings.fan_speed_percent,
      DEFAULT_GLOBAL_PROCESS.first_layers_fan_percent,
    ),
    speeds,
    supports_enabled:
      settings.supports_enabled ?? DEFAULT_GLOBAL_PROCESS.supports_enabled,
    adhesion_type:
      settings.adhesion_type ?? DEFAULT_GLOBAL_PROCESS.adhesion_type,
  };
}

function withDefault(value, fallback) {
  return value ?? fallback;
}

function collectOverrides(plates) {
  const overrides = {};
  for (const plate of plates) {
    for (const object of plate.objects) {
      if (object.settings) {
        const plateIndex = plate.index ?? object.plateIndex ?? 0;
        const key = makeObjectKey(object.name, plateIndex);
        overrides[key] = {
          ...object.settings,
          plateIndex,
          objectName: object.name,
        };
      }
    }
  }
  return overrides;
}

function buildPlates(metadata) {
  const plates = metadata.plates ?? [];
  if (plates.length === 0) return [];

  return plates.map((plate, index) => ({
    index: plate.index ?? index,
    name: plate.name ?? `Plate ${index + 1}`,
    objects: (plate.objects ?? []).map((object) => ({
      name: object.name ?? "object",
      plateIndex: plate.index ?? index,
      geometry:
        object.geometry ?? buildGeometryFromBounding(object.bounding_box_mm),
      settings: object.settings,
    })),
  }));
}

function buildGeometryFromBounding(bounding) {
  if (!bounding) {
    return null;
  }
  const [x, y, z] = bounding;
  const maxDimension = Math.max(x, y, z);
  const minDimension = Math.min(x, y, z);
  const ratio = minDimension === 0 ? null : z / minDimension;
  return {
    bounding_box_mm: bounding,
    max_dimension_mm: maxDimension,
    min_dimension_mm: minDimension,
    height_to_min_footprint_ratio: ratio,
    is_slender: ratio ? ratio > 4 : false,
  };
}
