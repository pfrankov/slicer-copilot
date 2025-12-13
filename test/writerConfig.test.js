import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { write3mf } from "../src/3mf/writer.js";

describe("write3mf (project_settings.config)", () => {
  it("preserves scalar vs array value shapes", async () => {
    const zip = new JSZip();
    const configPath = "Metadata/project_settings.config";
    const configData = {
      layer_height: "0.2",
      initial_layer_print_height: "0.2",
      wall_loops: "2",
      sparse_infill_density: "15%",
      nozzle_temperature: ["240", "240"],
      eng_plate_temp: ["70"],
      hot_plate_temp: ["70"],
      fan_max_speed: ["80"],
    };
    zip.file(configPath, JSON.stringify(configData));

    const normalized = {
      currentSettings: {
        globalProcess: {
          layer_height_mm: 0.18,
          first_layer_height_mm: 0.2,
          wall_line_count: 4,
          infill_density_percent: 25,
          nozzle_temp_c: 250,
          bed_temp_c: 75,
          fan_speed_percent: 40,
          first_layers_fan_percent: 0,
          speeds: {},
          supports_enabled: false,
          adhesion_type: "none",
        },
        perObjectOverrides: {},
      },
      projectSummary: {
        printer: { nozzle_diameter_mm: 0.4 },
        filaments: [{ material_family: "PETG" }],
        base_profile: null,
        plates: [],
      },
    };

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "slicer-copilot-writer-"),
    );
    const outputPath = path.join(tmpDir, "out.3mf");
    await write3mf(
      {
        zip,
        metadataPath: null,
        metadata: {},
        configPath,
        configData,
        normalized,
      },
      outputPath,
    );

    const outZip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const outConfig = JSON.parse(await outZip.file(configPath).async("string"));

    expect(outConfig.wall_loops).toBe("4");
    expect(outConfig.layer_height).toBe("0.18");
    expect(outConfig.nozzle_temperature).toEqual(["250", "250"]);
    expect(outConfig.eng_plate_temp).toEqual(["75"]);
  });

  it("updates different_settings_to_system for changed keys", async () => {
    const zip = new JSZip();
    const configPath = "Metadata/project_settings.config";
    const configData = {
      layer_height: "0.2",
      initial_layer_print_height: "0.2",
      wall_loops: "2",
      top_shell_layers: "5",
      bottom_shell_layers: "3",
      sparse_infill_density: "15%",
      sparse_infill_pattern: "grid",
      nozzle_temperature: ["243", "245"],
      nozzle_temperature_initial_layer: ["243", "245"],
      eng_plate_temp: ["70"],
      hot_plate_temp: ["70"],
      fan_max_speed: ["50"],
      first_x_layer_fan_speed: ["0"],
      enable_support: "0",
      brim_width: "0",
      raft_layers: "0",
      nozzle_diameter: ["0.4"],
      filament_type: ["PETG"],
      outer_wall_speed: ["40", "40"],
      inner_wall_speed: ["60", "60"],
      sparse_infill_speed: ["80", "80"],
      initial_layer_speed: ["30", "30"],
      different_settings_to_system: [
        "layer_height",
        "compatible_printers;eng_plate_temp;fan_max_speed;hot_plate_temp;nozzle_temperature;nozzle_temperature_initial_layer",
        "",
      ],
    };
    zip.file(configPath, JSON.stringify(configData));

    const normalized = {
      currentSettings: {
        globalProcess: {
          layer_height_mm: 0.2,
          first_layer_height_mm: 0.2,
          wall_line_count: 3,
          top_layers: 6,
          bottom_layers: 4,
          infill_density_percent: 20,
          infill_pattern: "gyroid",
          nozzle_temp_c: 250,
          bed_temp_c: 75,
          fan_speed_percent: 35,
          first_layers_fan_percent: 0,
          speeds: {
            wall_outer: 35,
            wall_inner: 55,
            infill: 70,
            first_layer: 30,
          },
          supports_enabled: false,
          adhesion_type: "none",
        },
        perObjectOverrides: {},
      },
      projectSummary: {
        printer: { nozzle_diameter_mm: 0.4 },
        filaments: [{ material_family: "PETG" }],
        base_profile: null,
        plates: [],
      },
    };

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "slicer-copilot-writer-"),
    );
    const outputPath = path.join(tmpDir, "out.3mf");
    await write3mf(
      {
        zip,
        metadataPath: null,
        metadata: {},
        configPath,
        configData,
        normalized,
      },
      outputPath,
    );

    const outZip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const outConfig = JSON.parse(await outZip.file(configPath).async("string"));

    expect(outConfig.different_settings_to_system).toEqual([
      "bottom_shell_layers;inner_wall_speed;layer_height;outer_wall_speed;sparse_infill_density;sparse_infill_pattern;sparse_infill_speed;top_shell_layers;wall_loops",
      "compatible_printers;eng_plate_temp;fan_max_speed;hot_plate_temp;nozzle_temperature;nozzle_temperature_initial_layer",
      "",
    ]);
  });

  it("keeps optional printer/filament fields untouched when absent", async () => {
    const zip = new JSZip();
    const configPath = "Metadata/project_settings.config";
    const configData = { different_settings_to_system: ["", "", ""] };
    zip.file(configPath, JSON.stringify(configData));

    const normalized = {
      currentSettings: {
        globalProcess: {
          layer_height_mm: 0.2,
          first_layer_height_mm: 0.2,
          wall_line_count: 2,
          top_layers: 4,
          bottom_layers: 4,
          infill_density_percent: 20,
          infill_pattern: "grid",
          nozzle_temp_c: 200,
          bed_temp_c: 60,
          fan_speed_percent: 80,
          first_layers_fan_percent: 0,
          speeds: {
            wall_outer: 40,
            wall_inner: 60,
            infill: 80,
            first_layer: 30,
          },
          supports_enabled: false,
          adhesion_type: "none",
        },
        perObjectOverrides: {},
      },
      projectSummary: {
        printer: {},
        filaments: [],
        base_profile: null,
        plates: [],
      },
    };

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "slicer-copilot-writer-"),
    );
    const outputPath = path.join(tmpDir, "out.3mf");
    await write3mf(
      {
        zip,
        metadataPath: null,
        metadata: {},
        configPath,
        configData,
        normalized,
      },
      outputPath,
    );

    const outZip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const outConfig = JSON.parse(await outZip.file(configPath).async("string"));
    expect(outConfig).not.toHaveProperty("nozzle_diameter");
    expect(outConfig).not.toHaveProperty("filament_type");
  });

  it("writes additional config keys when present in normalized settings", async () => {
    const zip = new JSZip();
    const configPath = "Metadata/project_settings.config";
    const configData = { travel_speed: "180", wall_loops: "2" };
    zip.file(configPath, JSON.stringify(configData));

    const normalized = {
      currentSettings: {
        globalProcess: {
          layer_height_mm: 0.2,
          wall_line_count: 2,
          travel_speed: "220",
        },
        perObjectOverrides: {},
      },
      projectSummary: {
        printer: { nozzle_diameter_mm: 0.4 },
        filaments: [{ material_family: "PETG" }],
        base_profile: null,
        plates: [],
      },
    };

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "slicer-copilot-writer-"),
    );
    const outputPath = path.join(tmpDir, "out.3mf");
    await write3mf(
      {
        zip,
        metadataPath: null,
        metadata: {},
        configPath,
        configData,
        normalized,
      },
      outputPath,
    );

    const outZip = await JSZip.loadAsync(fs.readFileSync(outputPath));
    const outConfig = JSON.parse(await outZip.file(configPath).async("string"));
    expect(outConfig.travel_speed).toBe("220");
  });
});
