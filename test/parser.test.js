import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parse3mfBuffer } from "../src/3mf/parser.js";
import { createSample3mf } from "./fixtures/sample3mf.js";

describe("parse3mfBuffer", () => {
  it("parses metadata and builds normalized model", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "sample.3mf");

    expect(parsed.metadata.settings.layer_height_mm).toBeCloseTo(0.22);
    expect(parsed.normalized.projectSummary.printer.name).toBe("Bambu Lab H2S");
    expect(parsed.normalized.currentSettings.globalProcess.infill_pattern).toBe(
      "grid",
    );
    expect(
      parsed.normalized.projectSummary.plates[0].objects[0].geometry.is_slender,
    ).toBe(false);
    expect(parsed.normalized.projectSummary.base_profile).toBe(
      "0.20mm Standard @BBL H2S",
    );
  });

  it("handles archives without metadata file", async () => {
    const zip = new JSZip();
    zip.file("3D/3dmodel.model", "<model><resources></resources></model>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "no-meta.3mf");
    expect(parsed.metadataPath).toBeNull();
    expect(parsed.metadata).toEqual({});
  });

  it("extracts printer/settings from .config JSON files used by Bambu Studio", async () => {
    const zip = new JSZip();
    const config = {
      printer_model: "Bambu Lab H2S",
      nozzle_diameter: ["0.4"],
      filament_type: ["PETG"],
      default_print_profile: "0.20mm Standard @BBL H2S",
      layer_height: "0.2",
      sparse_infill_density: "18%",
    };
    zip.file(
      "Metadata/project_settings.config",
      JSON.stringify(config, null, 2),
    );
    zip.file("3D/3dmodel.model", "<model><resources></resources></model>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await parse3mfBuffer(buffer, "project.3mf");
    const normalized = parsed.normalized;

    expect(normalized.projectSummary.printer.name).toBe("Bambu Lab H2S");
    expect(normalized.projectSummary.printer.nozzle_diameter_mm).toBeCloseTo(
      0.4,
    );
    expect(normalized.projectSummary.base_profile).toBe(
      "0.20mm Standard @BBL H2S",
    );
    expect(
      normalized.currentSettings.globalProcess.layer_height_mm,
    ).toBeCloseTo(0.2);
    expect(
      normalized.currentSettings.globalProcess.infill_density_percent,
    ).toBe(18);
    expect(normalized.projectSummary.filaments[0].material_family).toBe("PETG");
  });

  it("collects plate preview images when available", async () => {
    const zip = new JSZip();
    zip.file("3D/3dmodel.model", "<model><resources></resources></model>");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/xcAAn8B9nHaxLkAAAAASUVORK5CYII=",
      "base64",
    );
    zip.file("Metadata/plate_1.png", png);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "plates.3mf");
    expect(parsed.plateImages).toHaveLength(1);
    expect(parsed.plateImages[0].dataUrl).toContain("data:image/png;base64,");
    expect(parsed.plateImages[0].plateIndex).toBe(0);
  });
});
