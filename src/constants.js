export const DEFAULT_SPEEDS = {
  wall_outer: 40,
  wall_inner: 60,
  infill: 80,
  first_layer: 30,
};

export const DEFAULT_GLOBAL_PROCESS = {
  layer_height_mm: 0.2,
  first_layer_height_mm: 0.2,
  wall_line_count: 2,
  top_layers: 4,
  bottom_layers: 4,
  infill_density_percent: 15,
  infill_pattern: "grid",
  nozzle_temp_c: 215,
  bed_temp_c: 60,
  fan_speed_percent: 80,
  first_layers_fan_percent: 80,
  supports_enabled: false,
  adhesion_type: "none",
};

export const MATERIAL_LIMITS = {
  PLA: { nozzle: [180, 235], bed: [0, 70] },
  PETG: { nozzle: [220, 255], bed: [60, 90] },
  ABS: { nozzle: [230, 260], bed: [90, 110] },
  ASA: { nozzle: [235, 265], bed: [90, 110] },
  TPU: { nozzle: [200, 240], bed: [30, 60] },
  Nylon: { nozzle: [240, 270], bed: [70, 100] },
  PC: { nozzle: [250, 290], bed: [90, 120] },
};

export const FALLBACK_MATERIAL_LIMITS = {
  nozzle: [170, 280],
  bed: [0, 120],
};

export const LAYER_HEIGHT_MIN_MM = 0.05;
export const LAYER_HEIGHT_NOZZLE_RATIO_MAX = 0.8;
export const DEFAULT_NOZZLE_DIAMETER_MM = 0.4;

export const DEFAULT_MODEL = "gpt-4.1-mini";
export const DEFAULT_TEMPERATURE = 0.3;
