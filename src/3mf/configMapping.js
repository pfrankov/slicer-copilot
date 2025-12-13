export const GLOBAL_PROCESS_MAPPINGS = [
  {
    configKey: "layer_height",
    targetKey: "layer_height_mm",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "initial_layer_print_height",
    targetKey: "first_layer_height_mm",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "wall_loops",
    targetKey: "wall_line_count",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "top_shell_layers",
    targetKey: "top_layers",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "bottom_shell_layers",
    targetKey: "bottom_layers",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "sparse_infill_density",
    targetKey: "infill_density_percent",
    mode: "direct",
    parse: parsePercent,
    serialize: formatPercent,
  },
  {
    configKey: "sparse_infill_pattern",
    targetKey: "infill_pattern",
    mode: "direct",
    parse: parseString,
    serialize: passthrough,
  },
  {
    configKey: "nozzle_temperature",
    targetKey: "nozzle_temp_c",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "nozzle_temperature_initial_layer",
    targetKey: "nozzle_temp_c",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "eng_plate_temp",
    targetKey: "bed_temp_c",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "hot_plate_temp",
    targetKey: "bed_temp_c",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "fan_max_speed",
    targetKey: "fan_speed_percent",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "first_x_layer_fan_speed",
    targetKey: "first_layers_fan_percent",
    mode: "shaped",
    parse: parseNumber,
    serialize: passthrough,
  },
  {
    configKey: "enable_support",
    targetKey: "supports_enabled",
    mode: "direct",
    parse: parseSupportFlag,
    serialize: formatSupportFlag,
  },
];

export const SPEED_MAPPINGS = [
  { configKey: "outer_wall_speed", speedKey: "wall_outer" },
  { configKey: "inner_wall_speed", speedKey: "wall_inner" },
  { configKey: "sparse_infill_speed", speedKey: "infill" },
  { configKey: "initial_layer_speed", speedKey: "first_layer" },
];

const CONSUMED_CONFIG_KEYS = new Set([
  ...GLOBAL_PROCESS_MAPPINGS.map((m) => m.configKey),
  ...SPEED_MAPPINGS.map((m) => m.configKey),
  "raft_layers",
  "different_settings_to_system",
]);

export const ALLOWED_EXTRA_CONFIG_KEYS = new Set([
  // ========== SPEEDS ==========
  "travel_speed",
  "bridge_speed",
  "small_perimeter_speed",
  "top_surface_speed",
  "gap_infill_speed",
  "support_speed",
  "support_interface_speed",
  "internal_solid_infill_speed",
  "initial_layer_infill_speed",

  // Overhang speeds (for different overhang percentages)
  "overhang_1_4_speed", // 0-25% overhang
  "overhang_2_4_speed", // 25-50% overhang
  "overhang_3_4_speed", // 50-75% overhang
  "overhang_4_4_speed", // 75-100% overhang

  // ========== ACCELERATION & JERK ==========
  "travel_acceleration",
  "travel_jerk",
  "outer_wall_acceleration",
  "inner_wall_acceleration",
  "sparse_infill_acceleration",
  "initial_layer_acceleration",
  "top_surface_acceleration",
  "default_acceleration",
  "default_jerk",
  "infill_jerk",
  "inner_wall_jerk",
  "outer_wall_jerk",
  "initial_layer_jerk",
  "top_surface_jerk",

  // ========== COOLING ==========
  "overhang_fan_speed",
  "overhang_fan_threshold",
  "overhang_threshold_participating_cooling",
  "slow_down_layer_time",
  "slow_down_min_speed",
  "fan_min_speed",
  "fan_cooling_layer_time",
  "full_fan_speed_layer",
  "close_fan_the_first_x_layers",
  "enable_overhang_bridge_fan",

  // ========== LINE WIDTHS ==========
  "line_width",
  "outer_wall_line_width",
  "inner_wall_line_width",
  "sparse_infill_line_width",
  "initial_layer_line_width",
  "internal_solid_infill_line_width",
  "top_surface_line_width",
  "support_line_width",

  // ========== WALL SETTINGS ==========
  "wall_sequence",
  "wall_generator", // classic or arachne
  "detect_thin_wall",
  "detect_overhang_wall",
  "only_one_wall_first_layer",
  "min_bead_width", // for arachne
  "min_feature_size", // for arachne
  "wall_distribution_count",
  "wall_transition_angle",
  "wall_transition_length",
  "wall_transition_filter_deviation",
  "precise_outer_wall",

  // ========== TOP/BOTTOM SURFACE ==========
  "top_surface_pattern",
  "bottom_surface_pattern",
  "ironing_type",
  "ironing_speed",
  "ironing_flow",
  "ironing_spacing",
  "ironing_pattern",
  "top_solid_infill_flow_ratio",
  "top_one_wall_type",

  // ========== INFILL ==========
  "sparse_infill_anchor",
  "sparse_infill_anchor_max",
  "infill_direction",
  "infill_wall_overlap",
  "infill_combination", // combine infill layers
  "minimum_sparse_infill_area",
  "internal_solid_infill_pattern",
  "filter_out_gap_fill",

  // ========== SUPPORTS ==========
  "support_threshold_angle",
  "support_style",
  "support_type", // normal, tree, tree(auto), organic
  "support_top_z_distance",
  "support_bottom_z_distance",
  "support_object_xy_distance",
  "support_on_build_plate_only",
  "support_critical_regions_only",
  "support_interface_top_layers",
  "support_interface_bottom_layers",
  "support_interface_spacing",
  "support_interface_pattern",
  "support_base_pattern",
  "support_base_pattern_spacing",
  "support_expansion",
  "independent_support_layer_height",
  // Tree support specific
  "tree_support_branch_angle",
  "tree_support_branch_diameter",
  "tree_support_branch_diameter_angle",
  "tree_support_branch_distance",
  "tree_support_wall_count",

  // ========== ADHESION ==========
  "brim_width",
  "brim_type", // auto_brim, outer_only, inner_only, no_brim
  "brim_object_gap",
  "skirt_distance",
  "skirt_loops",
  "skirt_height",
  "raft_layers",
  "raft_contact_distance",
  "raft_expansion",
  "raft_first_layer_density",
  "raft_first_layer_expansion",

  // ========== RETRACTION ==========
  "z_hop",
  "z_hop_types", // Normal Lift, Spiral Lift, etc.
  "retraction_length",
  "retraction_speed",
  "retraction_minimum_travel",
  "retract_when_changing_layer",
  "wipe",
  "wipe_distance",
  "wipe_speed",
  "retract_before_wipe",
  "deretraction_speed",

  // ========== FLOW ==========
  "filament_flow_ratio",
  "print_flow_ratio",
  "initial_layer_flow_ratio",
  "bridge_flow",
  "filament_max_volumetric_speed",

  // ========== SEAM ==========
  "seam_position",
  "seam_gap",
  "seam_slope_type", // scarf seam: none, external, all
  "seam_slope_conditional",
  "seam_slope_inner_walls",
  "seam_slope_steps",
  "seam_slope_start_height",
  "seam_slope_min_length",

  // ========== DIMENSIONAL ACCURACY ==========
  "xy_hole_compensation",
  "xy_contour_compensation",
  "elefant_foot_compensation",
  "resolution",
  "slice_closing_radius",

  // ========== SPECIAL MODES ==========
  "spiral_mode", // vase mode
  "spiral_mode_smooth",
  "spiral_mode_max_xy_smoothing",
  "fuzzy_skin", // none, external, all
  "fuzzy_skin_thickness",
  "fuzzy_skin_point_distance",

  // ========== BRIDGES ==========
  "thick_bridges",
  "bridge_no_support",
  "bridge_angle",
  "max_bridge_length",
  "internal_bridge_support_thickness",

  // ========== PRESSURE ADVANCE ==========
  "pressure_advance",
  "enable_pressure_advance",

  // ========== ARC FITTING ==========
  "enable_arc_fitting",

  // ========== PRIME TOWER ==========
  "enable_prime_tower",
  "prime_tower_width",
  "prime_tower_rib_width",
  "prime_tower_lift_height",
  "prime_tower_max_speed",
  "prime_tower_brim_width",
  "wipe_tower_x",
  "wipe_tower_y",

  // ========== MISC ==========
  "avoid_crossing_wall", // avoid crossing walls during travel
  "reduce_crossing_wall",
  "reduce_infill_retraction",
  "complete_objects", // print objects one by one
  "print_sequence", // by layer, by object
  "exclude_object", // allow excluding objects mid-print
]);

/**
 * Map a Bambu Studio `.config` JSON payload into the normalized settings shape.
 *
 * - Known keys are parsed and mapped into canonical names.
 * - A curated list of additional keys is carried through as-is.
 *
 * @param {object} options
 * @param {Record<string, any>} options.config
 * @param {Record<string, any>} options.baseSettings
 * @returns {Record<string, any>}
 */
export function mapConfigToSettings({ config, baseSettings }) {
  const normalizedConfig = normalizeConfigEntries(config);
  const next = { ...baseSettings };
  const populated = new Set();

  GLOBAL_PROCESS_MAPPINGS.forEach((mapping) => {
    const parsed = mapping.parse(normalizedConfig[mapping.configKey]);
    if (parsed === null || parsed === undefined) return;
    if (populated.has(mapping.targetKey)) return;
    next[mapping.targetKey] = parsed;
    populated.add(mapping.targetKey);
  });

  applyAdhesionFromConfig({ config: normalizedConfig, settings: next });
  applySpeedsFromConfig({ config: normalizedConfig, settings: next });
  mergeRemainingConfig({ config: normalizedConfig, settings: next });
  return next;
}

/**
 * Coerce a value to `number`, returning `null` when the value is missing/invalid.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function numberOrNull(value) {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/**
 * Convert a percent-like value (`"15%"`, `"15"`, `15`) into a number.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function percentToNumber(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).replace("%", "").trim();
  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumber(value) {
  return numberOrNull(first(value));
}

function parsePercent(value) {
  return percentToNumber(first(value));
}

function parseString(value) {
  const raw = first(value);
  return raw === undefined || raw === null ? null : raw;
}

function parseSupportFlag(value) {
  const raw = first(value);
  if (raw === undefined || raw === null) return null;
  return raw === "1" || raw === 1 || raw === true || raw === "true";
}

function formatPercent(value) {
  if (value === undefined || value === null) return undefined;
  return `${value}%`;
}

function formatSupportFlag(value) {
  if (value === undefined || value === null) return undefined;
  return value ? "1" : "0";
}

function applyAdhesionFromConfig({ config, settings }) {
  const raft = parseNumber(config.raft_layers);
  const brim = parseNumber(config.brim_width);
  if (raft && raft > 0) {
    settings.adhesion_type = "raft";
    return;
  }
  if (brim && brim > 0) {
    settings.adhesion_type = "brim";
  }
}

function applySpeedsFromConfig({ config, settings }) {
  const speeds = { ...(settings.speeds ?? {}) };
  let touched = false;
  SPEED_MAPPINGS.forEach(({ configKey, speedKey }) => {
    const value = parseNumber(config[configKey]);
    if (value === null || value === undefined) return;
    speeds[speedKey] = value;
    touched = true;
  });

  if (touched) {
    settings.speeds = speeds;
  }
}

function mergeRemainingConfig({ config, settings }) {
  Object.entries(config).forEach(([key, value]) => {
    if (CONSUMED_CONFIG_KEYS.has(key)) return;
    if (!ALLOWED_EXTRA_CONFIG_KEYS.has(key)) return;
    if (settings[key] !== undefined) return;
    settings[key] = value;
  });
}

function normalizeConfigEntries(config) {
  const normalized = {};
  Object.entries(config ?? {}).forEach(([key, value]) => {
    normalized[key] = unwrapSingle(value);
  });
  return normalized;
}

function unwrapSingle(value) {
  if (Array.isArray(value) && value.length === 1) return value[0];
  return value;
}

function first(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function passthrough(value) {
  return value;
}
