import { describe, expect, it } from "vitest";
import {
  GLOBAL_PROCESS_MAPPINGS,
  mapConfigToSettings,
} from "../src/3mf/configMapping.js";

describe("configMapping", () => {
  it("prefers first mapping for duplicates and applies raft and speeds", () => {
    const result = mapConfigToSettings({
      config: {
        nozzle_temperature: ["230"],
        nozzle_temperature_initial_layer: ["240"],
        eng_plate_temp: ["60"],
        hot_plate_temp: ["65"],
        raft_layers: "2",
        sparse_infill_pattern: "gyroid",
        outer_wall_speed: "45",
        initial_layer_speed: ["25"],
        enable_support: "0",
      },
      baseSettings: { adhesion_type: "none", speeds: { wall_inner: 55 } },
    });

    expect(result.nozzle_temp_c).toBe(230);
    expect(result.bed_temp_c).toBe(60);
    expect(result.adhesion_type).toBe("raft");
    expect(result.speeds.wall_outer).toBe(45);
    expect(result.speeds.first_layer).toBe(25);
    expect(result.speeds.wall_inner).toBe(55);
    expect(result.supports_enabled).toBe(false);
    expect(result.infill_pattern).toBe("gyroid");

    const densityMapping = GLOBAL_PROCESS_MAPPINGS.find(
      (mapping) => mapping.targetKey === "infill_density_percent",
    );
    const supportMapping = GLOBAL_PROCESS_MAPPINGS.find(
      (mapping) => mapping.targetKey === "supports_enabled",
    );
    expect(densityMapping.serialize(undefined)).toBeUndefined();
    expect(supportMapping.serialize(undefined)).toBeUndefined();
    expect(supportMapping.serialize(true)).toBe("1");
  });

  it("skips invalid numeric and percent values", () => {
    const result = mapConfigToSettings({
      config: {
        wall_loops: "fast",
        sparse_infill_density: "abc%",
      },
      baseSettings: {},
    });
    expect(result.wall_line_count).toBeUndefined();
    expect(result.infill_density_percent).toBeUndefined();
  });

  it("preserves allowed additional config entries for later customization", () => {
    const result = mapConfigToSettings({
      config: { travel_speed: "200", brim_width: "5", unknown_param: "foo" },
      baseSettings: {},
    });
    expect(result.travel_speed).toBe("200");
    expect(result.brim_width).toBe("5");
    expect(result.unknown_param).toBeUndefined();
  });

  it("handles missing config object and keeps base settings intact", () => {
    const result = mapConfigToSettings({
      config: undefined,
      baseSettings: { custom_flag: true },
    });
    expect(result.custom_flag).toBe(true);
  });

  it("parses non-array numeric config values", () => {
    const result = mapConfigToSettings({
      config: { layer_height: 0.21 },
      baseSettings: {},
    });
    expect(result.layer_height_mm).toBeCloseTo(0.21);
  });

  it("parses array-based numeric config values using the first element", () => {
    const result = mapConfigToSettings({
      config: { nozzle_temperature: ["210", "215"] },
      baseSettings: {},
    });
    expect(result.nozzle_temp_c).toBe(210);
  });

  it("ignores disallowed keys such as custom gcode", () => {
    const result = mapConfigToSettings({
      config: { layer_change_gcode: "M600", travel_speed: "150" },
      baseSettings: {},
    });
    expect(result.layer_change_gcode).toBeUndefined();
    expect(result.travel_speed).toBe("150");
  });

  it("unwraps single-element arrays but keeps base setting precedence", () => {
    const result = mapConfigToSettings({
      config: { travel_speed: ["170"] },
      baseSettings: { travel_speed: "180" },
    });
    expect(result.travel_speed).toBe("180");
  });
});
