import { describe, expect, it } from "vitest";
import { parse3mfBuffer } from "../src/3mf/parser.js";
import { applyLlmChanges } from "../src/apply/changes.js";
import { createSample3mf } from "./fixtures/sample3mf.js";
import { readObjectOverride } from "../src/utils/objectOverrides.js";

describe("applyLlmChanges", () => {
  it("applies global and object changes without safety enforcement", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "sample.3mf");

    const response = {
      version: 1,
      warnings: ["LLM warning"],
      changes: [
        {
          scope: "global",
          parameter: "layer_height_mm",
          newValue: 0.5,
          changeType: "absolute",
          reason: "quality",
        },
        {
          scope: "global",
          parameter: "speeds.wall_outer",
          newValue: 99,
          changeType: "absolute",
          reason: "surface",
        },
        {
          scope: "global",
          parameter: "wall_line_count",
          newValue: -0.5,
          changeType: "relative",
          reason: "speed",
        },
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 0 },
          parameter: "supports_enabled",
          newValue: true,
          changeType: "absolute",
          reason: "stability",
        },
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 0 },
          parameter: "adhesion_type",
          newValue: "raft",
          changeType: "absolute",
          reason: "adhesion",
        },
      ],
    };

    const { updated, warnings, diffs } = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });

    expect(updated.currentSettings.globalProcess.layer_height_mm).toBe(0.5);
    expect(updated.currentSettings.globalProcess.speeds.wall_outer).toBe(99);
    expect(updated.currentSettings.globalProcess.wall_line_count).toBe(1.5);
    const override = readObjectOverride(
      updated.currentSettings.perObjectOverrides,
      { objectName: "CalibrationCube", plateIndex: 0 },
    );
    expect(override.supports_enabled).toBe(true);
    expect(override.adhesion_type).toBe("raft");
    expect(warnings).toContain("LLM warning");
    expect(diffs.length).toBe(5);
  });

  it("keeps overrides distinct when object names repeat across plates", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "sample.3mf");
    parsed.normalized.projectSummary.plates.push({
      index: 1,
      name: "Plate 2",
      objects: [{ name: "CalibrationCube", plateIndex: 1 }],
    });

    const response = {
      version: 1,
      changes: [
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 1 },
          parameter: "supports_enabled",
          newValue: false,
        },
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 0 },
          parameter: "supports_enabled",
          newValue: true,
        },
      ],
    };

    const { updated } = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });

    const plate0 = readObjectOverride(
      updated.currentSettings.perObjectOverrides,
      { objectName: "CalibrationCube", plateIndex: 0 },
    );
    const plate1 = readObjectOverride(
      updated.currentSettings.perObjectOverrides,
      { objectName: "CalibrationCube", plateIndex: 1 },
    );
    expect(plate0.supports_enabled).toBe(true);
    expect(plate1.supports_enabled).toBe(false);
  });

  it("skips invalid relative changes and reports missing targets/unknown params", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "sample.3mf");
    const response = {
      version: 1,
      changes: [
        {
          scope: "global",
          parameter: "top_layers",
          newValue: "bad",
          changeType: "relative",
        },
        { scope: "global", parameter: "unknown_param", newValue: 1 },
        { scope: "object", parameter: "supports_enabled", newValue: true },
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 0 },
          parameter: "unknown_object_param",
          newValue: 1,
        },
      ],
    };
    const result = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });
    expect(
      result.warnings.some((w) => w.includes("Relative change for top_layers")),
    ).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.includes("Unknown parameter unknown_param"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.includes("Object supports_enabled not found"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.includes(
          "Unknown parameter unknown_object_param for object CalibrationCube",
        ),
      ),
    ).toBe(true);
  });

  it("protects user-modified settings by default and allows overrides when requested", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: { printer: {}, filaments: [], plates: [] },
      currentSettings: {
        globalProcess: { fan_speed_percent: 30 },
        perObjectOverrides: {},
      },
      userModifiedSettings: ["fan_speed_percent", null],
    };
    const response = {
      version: 1,
      changes: [
        { scope: "global", parameter: "fan_speed_percent", newValue: 50 },
      ],
    };
    const protectedResult = applyLlmChanges({ normalized, response });
    expect(
      protectedResult.updated.currentSettings.globalProcess.fan_speed_percent,
    ).toBe(30);
    expect(
      protectedResult.warnings.some((w) => w.includes("fan_speed_percent")),
    ).toBe(true);

    const overridden = applyLlmChanges({
      normalized,
      response,
      respectUserSettings: false,
    });
    expect(
      overridden.updated.currentSettings.globalProcess.fan_speed_percent,
    ).toBe(50);
  });

  it("matches user-modified settings by normalized key when underscores differ", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: { printer: {}, filaments: [], plates: [] },
      currentSettings: {
        globalProcess: { fan_speed_percent: 25 },
        perObjectOverrides: {},
      },
      userModifiedSettings: ["fan-speed-percent"],
    };
    const response = {
      version: 1,
      changes: [
        { scope: "global", parameter: "fan_speed_percent", newValue: 60 },
      ],
    };
    const result = applyLlmChanges({ normalized, response });
    expect(result.updated.currentSettings.globalProcess.fan_speed_percent).toBe(
      25,
    );
    expect(result.warnings.some((w) => w.includes("fan_speed_percent"))).toBe(
      true,
    );
  });

  it("handles missing userModifiedSettings arrays", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: { printer: {}, filaments: [], plates: [] },
      currentSettings: {
        globalProcess: { infill_density_percent: 20 },
        perObjectOverrides: {},
      },
    };
    const response = {
      version: 1,
      changes: [
        {
          scope: "global",
          parameter: "infill_density_percent",
          newValue: 30,
        },
      ],
    };
    const result = applyLlmChanges({ normalized, response });
    expect(
      result.updated.currentSettings.globalProcess.infill_density_percent,
    ).toBe(30);
  });
});
