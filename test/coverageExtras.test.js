import fs from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it, vi, afterEach, afterAll } from "vitest";
import { parse3mfBuffer } from "../src/3mf/parser.js";
import { write3mf, updateMetadataFromNormalized } from "../src/3mf/writer.js";
import { createLogger } from "../src/logger.js";
import { loadConfig } from "../src/config.js";
import {
  formatDiffs,
  summarizeProject,
  formatJsonForConsole,
  formatRationale,
  formatWarnings,
  formatSuccess,
  formatError,
  formatInfo,
  createHeader,
  statusMessage,
  divider,
  palette,
  figures,
} from "../src/utils/summary.js";
import { defaultOutputPath, loadIntent } from "../src/cli.js";
import { applyLlmChanges } from "../src/apply/changes.js";
import { createEmptyIntent } from "../src/intent/intent.js";
import { createSample3mf } from "./fixtures/sample3mf.js";
import { buildLlmRequestPayload } from "../src/llm/requestBuilder.js";
import { createI18n, normalizeLanguage } from "../src/i18n.js";

describe("coverage extras", () => {
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  // eslint-disable-next-line no-control-regex
  const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/g, "");

  afterEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it("parses defaults for speeds and geometry from bounding box", async () => {
    const zip = new JSZip();
    const metadata = {
      printer: {
        name: "Test Printer",
        nozzle_diameter_mm: 0.6,
      },
      filaments: [{ material_family: "PETG" }],
      settings: { layer_height_mm: 0.3, infill_density_percent: 20 },
      plates: [
        {
          index: 0,
          name: "P",
          objects: [{ name: "Obj", bounding_box_mm: [10, 5, 50] }],
        },
      ],
    };
    zip.file("metadata.json", JSON.stringify(metadata));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "temp.3mf");
    expect(
      parsed.normalized.currentSettings.globalProcess.speeds.wall_outer,
    ).toBe(40);
    expect(
      parsed.normalized.projectSummary.plates[0].objects[0].geometry.is_slender,
    ).toBe(true);
  });

  it("writes with default metadata path when missing", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "3mf-write-"));
    const output = path.join(tmpDir, "out.3mf");
    const zip = new JSZip();
    const project = { zip, metadata: { foo: "bar" }, metadataPath: null };
    await write3mf(project, output);
    const loaded = await JSZip.loadAsync(fs.readFileSync(output));
    expect(loaded.file("metadata.json")).toBeTruthy();
  });

  it("extracts userModifiedSettings from different_settings_to_system", async () => {
    const zip = new JSZip();
    const metadata = {
      printer: { name: "P", nozzle_diameter_mm: 0.4 },
      filaments: [{ material_family: "PLA" }],
      settings: { layer_height_mm: 0.2 },
    };
    zip.file("Metadata/metadata.json", JSON.stringify(metadata));
    const config = {
      different_settings_to_system: [
        "layer_height;wall_loops",
        "nozzle_temperature",
        "",
      ],
    };
    zip.file("Metadata/project_settings.config", JSON.stringify(config));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "test.3mf");
    expect(parsed.normalized.userModifiedSettings).toEqual([
      "layer_height",
      "wall_loops",
      "nozzle_temperature",
    ]);
  });

  it("returns empty userModifiedSettings when no config", async () => {
    const zip = new JSZip();
    const metadata = {
      printer: { name: "P", nozzle_diameter_mm: 0.4 },
      filaments: [{ material_family: "PLA" }],
      settings: { layer_height_mm: 0.2 },
    };
    zip.file("Metadata/metadata.json", JSON.stringify(metadata));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "test.3mf");
    expect(parsed.normalized.userModifiedSettings).toEqual([]);
  });

  it("loads config from env and logs debug when verbose", () => {
    process.env.LLM_MOCK_RESPONSE = "env-mock.json";
    const cfg = loadConfig();
    const logger = createLogger(true);
    logger.debug("debug");
    expect(cfg.mockResponsePath).toBe("env-mock.json");
    expect(consoleSpy).toHaveBeenCalled();
    delete process.env.LLM_MOCK_RESPONSE;
  });

  it("formats empty diffs and computes fallback output path", () => {
    expect(stripAnsi(formatDiffs([]))).toContain("No changes applied");
    expect(defaultOutputPath("model")).toBe("model.optimized.3mf");
    expect(defaultOutputPath("model.3mf")).toBe("model.optimized.3mf");
    const table = formatDiffs([
      {
        scope: "object",
        parameter: "x",
        from: 1,
        to: 2,
        reason: "",
        target: null,
      },
    ]);
    expect(stripAnsi(table)).toContain("object@p?");
  });

  it("formats tables responsively and colorizes JSON output", () => {
    process.stdout.columns = 120;
    const table = formatDiffs([
      {
        scope: "global",
        parameter: "fan_speed_percent",
        from: undefined,
        to: 50,
        reason: "safer cooling",
      },
      {
        scope: "object",
        parameter: "tags",
        from: null,
        to: ["fast", "quiet"],
        reason: "",
        target: { objectName: "Cube", plateIndex: 1 },
      },
    ]);
    delete process.stdout.columns;
    expect(table).toContain("fan_speed_percent");
    expect(table).toContain("Cube@p1");
    expect(table).toContain("→");
    const coloredJson = formatJsonForConsole({
      name: "demo",
      enabled: true,
      count: 2,
      meta: null,
    });
    const plainJson = stripAnsi(coloredJson);
    expect(plainJson).toContain('"name": "demo"');
    expect(plainJson).toContain('"enabled": true');
    expect(plainJson).toContain('"count": 2');
    expect(plainJson).toContain('"meta": null');
  });

  it("summarizes project when process settings are missing", () => {
    const summary = summarizeProject({
      fileName: "fallback.3mf",
      projectSummary: {
        printer: {
          name: "Printer",
          nozzle_diameter_mm: 0.4,
        },
        filaments: [],
        plates: [],
        base_profile: null,
      },
      currentSettings: {},
    });
    const plainSummary = stripAnsi(summary);
    expect(plainSummary).toContain("fallback.3mf");
    expect(plainSummary).toContain("Unknown");
    expect(plainSummary).toContain("Process"); // Row exists even without settings
    expect(plainSummary).not.toContain("Layout"); // plates omitted when unavailable
  });

  it("omits enclosure details entirely", () => {
    const summary = summarizeProject({
      fileName: "no-enclosure.3mf",
      projectSummary: {
        printer: {
          name: "Open Printer",
          nozzle_diameter_mm: 0.4,
        },
        filaments: [],
        plates: [],
        base_profile: null,
      },
      currentSettings: {},
    });
    const plainSummary = stripAnsi(summary);
    expect(plainSummary).toContain("Open Printer");
    expect(plainSummary).not.toContain("enclosed");
  });

  it("formats new UI components: warnings, success, error, info, header, status, divider", () => {
    // formatWarnings
    const noWarnings = formatWarnings([]);
    expect(noWarnings).toBe("");

    const withWarnings = formatWarnings(["Test warning 1", "Test warning 2"]);
    expect(stripAnsi(withWarnings)).toContain("Test warning 1");
    expect(stripAnsi(withWarnings)).toContain("Warnings");

    // formatSuccess
    const success = formatSuccess("Operation completed");
    expect(stripAnsi(success)).toContain("Operation completed");
    expect(stripAnsi(success)).toContain("✔");

    // formatError
    const error = formatError("Something went wrong");
    expect(stripAnsi(error)).toContain("Something went wrong");
    expect(stripAnsi(error)).toContain("✘");

    // formatInfo
    const info = formatInfo("Helpful information");
    expect(stripAnsi(info)).toContain("Helpful information");
    expect(stripAnsi(info)).toContain("ℹ");

    // createHeader
    const header = createHeader("Test Title", "Subtitle here");
    expect(stripAnsi(header)).toContain("Test Title");
    expect(stripAnsi(header)).toContain("Subtitle here");
    expect(stripAnsi(header)).toContain("Slicer Copilot");

    const headerNoSubtitle = createHeader("Just Title");
    expect(stripAnsi(headerNoSubtitle)).toContain("Just Title");

    // statusMessage
    const successStatus = statusMessage("success", "All good");
    expect(stripAnsi(successStatus)).toContain("All good");
    expect(stripAnsi(successStatus)).toContain("✔");

    const warningStatus = statusMessage("warning", "Careful");
    expect(stripAnsi(warningStatus)).toContain("Careful");
    expect(stripAnsi(warningStatus)).toContain("⚠");

    const errorStatus = statusMessage("error", "Failed");
    expect(stripAnsi(errorStatus)).toContain("Failed");

    const infoStatus = statusMessage("info", "Note");
    expect(stripAnsi(infoStatus)).toContain("Note");

    const pendingStatus = statusMessage("pending", "Working");
    expect(stripAnsi(pendingStatus)).toContain("Working");

    const unknownStatus = statusMessage("unknown", "Test");
    expect(stripAnsi(unknownStatus)).toContain("Test");

    const localized = createI18n("fr-CA");
    expect(localized.language).toBe("fr");
    expect(localized.t("nonInteractiveIntent").toLowerCase()).toContain(
      "non interactif",
    );
    expect(normalizeLanguage("xx-YY")).toBe("en");
    expect(localized.t("missing_key")).toBe("missing_key");
    const english = createI18n("en");
    expect(english.t("writeSuccess")).toContain("{path}");
    expect(english.t("writeSuccess", { path: "/tmp/out.3mf" })).toContain(
      "/tmp/out.3mf",
    );

    // divider
    const simpleDivider = divider();
    expect(stripAnsi(simpleDivider)).toMatch(/─+/);

    const labeledDivider = divider("Section");
    expect(stripAnsi(labeledDivider)).toContain("Section");
    expect(stripAnsi(labeledDivider)).toMatch(/─+/);

    // formatRationale
    const noRationale = formatRationale("");
    expect(noRationale).toBe("");

    const nullRationale = formatRationale(null);
    expect(nullRationale).toBe("");

    const undefinedRationale = formatRationale(undefined);
    expect(undefinedRationale).toBe("");

    const whitespaceRationale = formatRationale("   ");
    expect(whitespaceRationale).toBe("");

    const validRationale = formatRationale(
      "Optimizing for strength and speed balance.",
    );
    expect(stripAnsi(validRationale)).toContain("Optimizing for strength");
    expect(stripAnsi(validRationale)).toContain("Strategy");

    // palette and figures exports
    expect(typeof palette.primary).toBe("function");
    expect(typeof figures.tick).toBe("string");
  });

  it("calls prompt intent branch through loadIntent", async () => {
    const intentModule = await import("../src/intent/intent.js");
    const promptSpy = vi
      .spyOn(intentModule, "promptIntent")
      .mockResolvedValue(createEmptyIntent());
    const intent = await loadIntent(
      { nonInteractive: false, intentFile: null },
      { log: () => {} },
    );
    expect(intent).toHaveProperty("primary_goal");
    expect(promptSpy).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it("loads intent from file path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "intent-"));
    const intentPath = path.join(tmpDir, "intent.json");
    fs.writeFileSync(
      intentPath,
      JSON.stringify({ primary_goal: "visual_quality" }),
    );
    const intent = await loadIntent(
      { intentFile: intentPath, nonInteractive: false },
      { log: () => {} },
    );
    expect(intent.primary_goal).toBe("visual_quality");
  });

  it("applies additional change branches including speeds and unknown targets", async () => {
    const zip = new JSZip();
    const metadata = {
      printer: { name: "P", nozzle_diameter_mm: 0.4 },
      filaments: [{ material_family: "PLA" }],
      settings: { layer_height_mm: 0.2 },
      plates: [
        {
          index: 0,
          name: "Plate",
          objects: [
            { name: "Thing", bounding_box_mm: [10, 10, 10] },
            { name: "Another", bounding_box_mm: [5, 5, 5] },
          ],
        },
      ],
    };
    zip.file("metadata.json", JSON.stringify(metadata));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "extra.3mf");
    const response = {
      version: 1,
      changes: [
        {
          scope: "global",
          parameter: "speeds.wall_outer",
          newValue: 0.5,
          changeType: "relative",
        },
        {
          scope: "global",
          parameter: "fan_speed_percent",
          newValue: 150,
          changeType: "absolute",
        },
        {
          scope: "object",
          target: { objectName: "Missing", plateIndex: 0 },
          parameter: "infill_density_percent",
          newValue: 5,
        },
        {
          scope: "object",
          target: { objectName: "Thing", plateIndex: 0 },
          parameter: "nonexistent",
          newValue: 2,
        },
        {
          scope: "object",
          target: { objectName: "Thing", plateIndex: 0 },
          parameter: "supports_enabled",
          newValue: true,
        },
        {
          scope: "object",
          target: { objectName: "Another", plateIndex: 0 },
          parameter: "supports_enabled",
          newValue: false,
        },
      ],
    };
    const result = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: createEmptyIntent(),
    });
    expect(
      result.updated.currentSettings.globalProcess.speeds.wall_outer,
    ).toBeCloseTo(60);
    expect(result.updated.currentSettings.globalProcess.fan_speed_percent).toBe(
      150,
    );
    expect(result.warnings.some((w) => w.includes("Object Missing"))).toBe(
      true,
    );
    expect(
      result.warnings.some((w) => w.includes("Unknown parameter nonexistent")),
    ).toBe(true);
  });

  it("handles model entries without objects and missing geometry", async () => {
    const zip = new JSZip();
    zip.file("3D/3dmodel.model", "<model><resources></resources></model>");
    zip.file("metadata.json", JSON.stringify({ plates: [], settings: {} }));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "empty.3mf");
    expect(parsed.normalized.projectSummary.plates).toEqual([]);
  });

  it("uses existing quality preset when base profile missing", async () => {
    const { buffer, metadata } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "sample.3mf");
    parsed.normalized.projectSummary.base_profile = null;
    const next = updateMetadataFromNormalized(
      { ...metadata, quality_preset: "preset-a" },
      parsed.normalized,
    );
    expect(next.quality_preset).toBe("preset-a");
  });

  it("exercises apply change fallbacks and branch coverage", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "branch.3mf");
    parsed.normalized.projectSummary.filaments = [];
    const response = {
      version: 1,
      changes: [
        { parameter: "fan_speed_percent", newValue: 50 },
        { scope: "object", parameter: "wall_line_count", newValue: 2 },
        {
          scope: "object",
          target: { objectName: "CalibrationCube", plateIndex: 99 },
          parameter: "supports_enabled",
          newValue: true,
        },
        {
          scope: "object",
          target: { objectName: "CalibrationCube" },
          parameter: "speeds.infill",
          newValue: 0.1,
          changeType: "relative",
        },
        { scope: "global", parameter: "nozzle_temp_c", newValue: 999 },
        { scope: "global", parameter: "fan_speed_percent", newValue: "fast" },
        { scope: "global", parameter: "infill_density_percent", newValue: 30 },
        { scope: "global", parameter: "layer_height_mm", newValue: 0.2 },
      ],
    };
    const result = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });
    expect(
      result.warnings.some((w) => w.includes("Object wall_line_count")),
    ).toBe(true);
    expect(result.updated.currentSettings.globalProcess.nozzle_temp_c).toBe(
      999,
    );
  });

  it("logs payload when verbose CLI is used", async () => {
    const { buffer } = await createSample3mf();
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "slicer-copilot-verbose-"),
    );
    const inputPath = path.join(tmpDir, "input.3mf");
    const mockPath = path.join(tmpDir, "mock.json");
    fs.writeFileSync(inputPath, buffer);
    fs.writeFileSync(
      mockPath,
      JSON.stringify({ version: 1, changes: [], warnings: [] }),
    );
    process.env.AUTO_CONFIRM = "yes";
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    await import("../src/cli.js").then(({ runCli }) =>
      runCli([
        "node",
        "slicer-copilot",
        "--verbose",
        "--non-interactive",
        "--mock-response",
        mockPath,
        "--output",
        path.join(tmpDir, "out.3mf"),
        "optimize",
        inputPath,
      ]),
    );
    console.log = origLog;
    delete process.env.AUTO_CONFIRM;
    expect(logs.some((l) => l.includes("LLM system prompt"))).toBe(true);
    expect(logs.some((l) => l.includes("You are Slicer Copilot"))).toBe(true);
    expect(logs.some((l) => l.includes("LLM request payload"))).toBe(true);
  });

  it("covers remaining apply branches with defaulted fields", async () => {
    const { buffer } = await createSample3mf();
    const parsed = await parse3mfBuffer(buffer, "branch2.3mf");
    parsed.normalized.projectSummary.filaments = [];
    parsed.normalized.projectSummary.printer.nozzle_diameter_mm = undefined;
    const response = {
      version: 1,
      changes: [
        { scope: "object", parameter: "unused_param", newValue: 1 },
        {
          scope: "object",
          target: { name: "CalibrationCube" },
          parameter: "supports_enabled",
          newValue: true,
        },
        {
          scope: "global",
          parameter: "first_layers_fan_percent",
          newValue: 50,
        },
        { scope: "global", parameter: "layer_height_mm", newValue: 0.1 },
      ],
    };
    const result = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("formats diff table with undefined/null values", () => {
    const table = formatDiffs([
      {
        scope: "global",
        parameter: "fan_speed_percent",
        from: undefined,
        to: null,
        reason: undefined,
        target: null,
      },
      {
        scope: "object",
        target: { objectName: "Obj", plateIndex: 1 },
        parameter: "speed",
        from: 10,
        to: 20,
        reason: "test",
      },
      {
        scope: "object",
        parameter: "note",
        from: undefined,
        to: undefined,
        reason: "",
        target: undefined,
      },
    ]);
    const plain = stripAnsi(table);
    expect(plain).toContain("fan_speed_percent");
    expect(plain).toContain("→ null");
    expect(plain).toContain("Obj@p1");
    expect(plain).toContain("object@p?");
    expect(plain).toContain("→ —");
  });

  it("allows changing custom settings beyond the default subset", async () => {
    const zip = new JSZip();
    zip.file(
      "metadata.json",
      JSON.stringify({
        settings: { custom_flow_ratio: 0.9 },
        plates: [{ index: 0, name: "Plate", objects: [] }],
      }),
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "custom.3mf");
    const response = {
      version: 1,
      changes: [
        { scope: "global", parameter: "custom_flow_ratio", newValue: 1.05 },
      ],
    };
    const { updated, diffs } = applyLlmChanges({
      normalized: parsed.normalized,
      response,
      userIntent: {},
    });
    expect(updated.currentSettings.globalProcess.custom_flow_ratio).toBe(1.05);
    expect(diffs.some((d) => d.parameter === "custom_flow_ratio")).toBe(true);
  });

  it("builds request payload without empty intent defaults", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [
          {
            index: 0,
            name: "Plate",
            objects: [{ name: "Obj", geometry: undefined }],
          },
        ],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: {
        primary_goal: "visual_quality",
        locked_parameters: ["layer_height_mm"],
      },
      plateImages: [
        {
          name: "plate_1.png",
          plateIndex: 0,
          dataUrl: "data:image/png;base64,abc",
        },
      ],
    });
    expect(payload.projectSummary.base_profile).toBeNull();
    expect(payload.projectSummary.plates[0].objects[0].geometry).toBeNull();
    expect(payload.projectSummary.plates[0].objects[0].plateIndex).toBe(0);
    expect(payload).not.toHaveProperty("intentNarrative");
    expect(payload).not.toHaveProperty("safety");
    expect(payload.plateImages[0].dataUrl).toContain("data:image/png;base64");
    expect(payload.intentDetails.primary_goal).toBe("visual_quality");
    expect(payload.intentDetails.locked_parameters).toContain(
      "layer_height_mm",
    );
    expect(payload.intentDetails).not.toHaveProperty("load_bearing");
    expect(payload.intentDetails).not.toHaveProperty("safety_critical");
    expect(payload.intentDetails).not.toHaveProperty("preferred_focus");
    expect(payload.intentDetails).not.toHaveProperty("secondary_goals");
    expect(payload.intentDetails).not.toHaveProperty("constraints");
    expect(payload.intentDetails).not.toHaveProperty("free_text_description");
  });

  it("builds payload when plates are omitted", () => {
    const payload = buildLlmRequestPayload({
      normalized: {
        fileName: "demo.3mf",
        projectSummary: {
          printer: { name: "P", nozzle_diameter_mm: 0.4 },
          filaments: [],
          base_profile: null,
        },
        currentSettings: { globalProcess: {}, perObjectOverrides: {} },
      },
      userIntent: {},
      plateImages: [],
    });
    expect(payload.projectSummary).not.toHaveProperty("plates");
  });

  it("includes constraints and notes in intent details", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: {
          name: "P",
          nozzle_diameter_mm: 0.4,
          bed_type: "smooth_pei",
        },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: {
        primary_goal: "draft_fast",
        constraints: {
          max_print_time_hours: 2,
          material_saving_important: true,
        },
        locked_parameters: ["speed"],
        preferred_focus: ["bridging"],
        secondary_goals: ["visual_quality"],
        load_bearing: true,
        safety_critical: true,
        free_text_description: "thin fins",
      },
      plateImages: [{ name: "thumb", dataUrl: "data:image/png;base64,xyz" }],
    });
    expect(payload).not.toHaveProperty("intentNarrative");
    expect(payload.projectSummary).not.toHaveProperty("plates");
    expect(payload.intentDetails.constraints.max_print_time_hours).toBe(2);
    expect(payload.intentDetails.constraints.material_saving_important).toBe(
      true,
    );
    expect(payload.intentDetails.locked_parameters).toContain("speed");
    expect(payload.intentDetails.preferred_focus).toContain("bridging");
    expect(payload.intentDetails.secondary_goals).toContain("visual_quality");
    expect(payload.intentDetails.load_bearing).toBe(true);
    expect(payload.intentDetails.safety_critical).toBe(true);
    expect(payload.intentDetails.free_text_description).toBe("thin fins");
    expect(payload.plateImages[0].name).toBe("thumb");
    expect(payload.projectSummary.printer.bed_type).toBe("smooth_pei");
  });

  it("falls back to default intent details when intent missing", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: null,
      plateImages: [],
    });
    expect(payload).not.toHaveProperty("intentNarrative");
    expect(payload.intentDetails.primary_goal).toBe("balanced");
    expect(payload.intentDetails).not.toHaveProperty("free_text_description");
  });

  it("keeps unknown goals and plate images without indices", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: {
        primary_goal: "super_speed",
      },
      plateImages: [{ dataUrl: "data:image/png;base64,zzz" }],
    });
    expect(payload).not.toHaveProperty("intentNarrative");
    expect(payload.intentDetails.primary_goal).toBe("super_speed");
    expect(payload.plateImages[0].plateIndex).toBeNull();
    expect(payload.plateImages[0].name).toBe("plate.png");
  });

  it("falls back to default goal when intent lacks primary goal", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: {},
      plateImages: [],
    });
    expect(payload).not.toHaveProperty("intentNarrative");
    expect(payload.intentDetails.primary_goal).toBe("balanced");
  });

  it("includes bed type when present in config", async () => {
    const zip = new JSZip();
    const metadata = {
      printer: { name: "P", nozzle_diameter_mm: 0.4 },
      filaments: [],
      settings: { layer_height_mm: 0.2 },
    };
    zip.file("Metadata/metadata.json", JSON.stringify(metadata));
    zip.file(
      "Metadata/project_settings.config",
      JSON.stringify({ curr_bed_type: "textured_pei" }),
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "bed.3mf");
    expect(parsed.normalized.projectSummary.printer.bed_type).toBe(
      "textured_pei",
    );
    const summary = summarizeProject(parsed.normalized);
    expect(stripAnsi(summary)).toContain("textured_pei");
  });

  it("adds language and override controls to payload", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
      userModifiedSettings: ["fan_speed_percent"],
    };
    const payload = buildLlmRequestPayload({
      normalized,
      userIntent: {},
      plateImages: [],
      targetLanguage: "ru-RU",
      allowUserSettingOverrides: true,
    });
    expect(payload.targetLanguage).toBe("ru");
    expect(payload.allowUserSettingOverrides).toBe(true);
    expect(payload.userModifiedSettings).toContain("fan_speed_percent");
  });

  it("omits defaults and keeps only provided constraint fields", () => {
    const normalized = {
      fileName: "demo.3mf",
      projectSummary: {
        printer: { name: "P", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: undefined,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    };

    const blankGoal = buildLlmRequestPayload({
      normalized,
      userIntent: { primary_goal: "   " },
      plateImages: [],
    });
    expect(blankGoal.intentDetails.primary_goal).toBe("balanced");

    const onlyMaterialSaving = buildLlmRequestPayload({
      normalized,
      userIntent: {
        primary_goal: "draft_fast",
        constraints: { material_saving_important: true },
      },
      plateImages: [],
    });
    expect(onlyMaterialSaving.intentDetails.constraints).toEqual({
      material_saving_important: true,
    });

    const onlyMaxTimeString = buildLlmRequestPayload({
      normalized,
      userIntent: {
        primary_goal: "draft_fast",
        constraints: { max_print_time_hours: "2" },
      },
      plateImages: [],
    });
    expect(onlyMaxTimeString.intentDetails.constraints).toEqual({
      max_print_time_hours: "2",
    });
  });

  it("surfaces optimizer errors when JSON is invalid", async () => {
    vi.resetModules();
    const create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    vi.doMock("openai", () => ({
      default: vi.fn(() => ({
        chat: { completions: { create } },
      })),
    }));
    const { requestOptimization } =
      await import("../src/llm/optimizerClient.js");
    const payload = {
      version: 1,
      projectSummary: {
        fileName: "x",
        printer: { name: "p", nozzle_diameter_mm: 0.4 },
        filaments: [],
        base_profile: null,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
      plateImages: [],
    };
    await expect(
      requestOptimization({
        payload,
        config: { apiKey: "k", model: "m", temperature: 0.3 },
        logger: { debug: () => {} },
      }),
    ).rejects.toThrow(/Invalid JSON from LLM/);
    expect(create).toHaveBeenCalledTimes(1);
    vi.doUnmock("openai");
    vi.resetModules();
  });

  it("throws when api key missing and summarizes project fallback", async () => {
    const zip = new JSZip();
    zip.file("3D/3dmodel.model", "<model><resources></resources></model>");
    zip.file(
      "metadata.json",
      JSON.stringify({
        plates: [{ index: 0, name: "Plate 1", objects: [{ name: "NoGeo" }] }],
      }),
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const parsed = await parse3mfBuffer(buffer, "no-geo.3mf");
    const summary = summarizeProject(parsed.normalized);
    expect(summary).toContain("Unknown");
    await expect(
      (await import("../src/llm/optimizerClient.js")).requestOptimization({
        payload: {
          version: 1,
          projectSummary: parsed.normalized.projectSummary,
          currentSettings: parsed.normalized.currentSettings,
          userIntent: {},
        },
        config: { apiKey: "", model: "m", temperature: 0.3 },
        logger: { debug: () => {} },
      }),
    ).rejects.toThrow();
  });

  it("propagates unexpected errors from optimizer parsing", async () => {
    vi.resetModules();
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    vi.doMock("openai", () => ({
      default: vi.fn(() => ({
        chat: { completions: { create } },
      })),
    }));
    vi.doMock("../src/llm/responseValidator.js", () => ({
      parseLlmResponse: () => {
        throw new Error("boom");
      },
      InvalidLlmResponseError: class InvalidLlmResponseError extends Error {},
    }));
    const { requestOptimization } =
      await import("../src/llm/optimizerClient.js");
    await expect(
      requestOptimization({
        payload: {
          version: 1,
          projectSummary: { printer: {}, filaments: [], plates: [] },
          currentSettings: { globalProcess: {}, perObjectOverrides: {} },
          userIntent: {},
        },
        config: { apiKey: "k", model: "m", temperature: 0.2 },
        logger: { debug: () => {} },
      }),
    ).rejects.toThrow("boom");
    vi.doUnmock("openai");
    vi.doUnmock("../src/llm/responseValidator.js");
    vi.resetModules();
  });
});
