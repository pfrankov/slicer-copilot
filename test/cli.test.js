import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { defaultOutputPath, runCli } from "../src/cli.js";
import { createSample3mf } from "./fixtures/sample3mf.js";
import { parse3mfFile } from "../src/3mf/parser.js";

const mockResponse = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/mockResponse.json", import.meta.url),
    "utf8",
  ),
);

describe("CLI optimize", () => {
  it("runs optimize command with mock LLM and writes output", async () => {
    const { buffer } = await createSample3mf();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slicer-copilot-"));
    const inputPath = path.join(tmpDir, "input.3mf");
    const outputPath = path.join(tmpDir, "output.3mf");
    const mockPath = path.join(tmpDir, "mock.json");
    fs.writeFileSync(inputPath, buffer);
    fs.writeFileSync(mockPath, JSON.stringify(mockResponse));

    await runCli([
      "node",
      "slicer-copilot",
      "--non-interactive",
      "--output",
      outputPath,
      "--mock-response",
      mockPath,
      "optimize",
      inputPath,
    ]);

    expect(fs.existsSync(outputPath)).toBe(true);
    const parsed = await parse3mfFile(outputPath);
    expect(parsed.metadata.settings.wall_line_count).toBe(4);
    expect(parsed.metadata.plates[0].objects[0].settings.supports_enabled).toBe(
      true,
    );
  });

  it("supports dry-run and error handling", async () => {
    const { buffer } = await createSample3mf();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slicer-copilot-"));
    const inputPath = path.join(tmpDir, "input.3mf");
    const mockPath = path.join(tmpDir, "mock.json");
    fs.writeFileSync(inputPath, buffer);
    fs.writeFileSync(mockPath, JSON.stringify(mockResponse));
    await runCli([
      "node",
      "slicer-copilot",
      "--non-interactive",
      "--dry-run",
      "--mock-response",
      mockPath,
      "optimize",
      inputPath,
    ]);
    await runCli([
      "node",
      "slicer-copilot",
      "optimize",
      path.join(tmpDir, "missing.3mf"),
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it("always proceeds and writes default output when not specified", async () => {
    const { buffer } = await createSample3mf();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slicer-copilot-"));
    const inputPath = path.join(tmpDir, "input.3mf");
    const intentPath = path.join(tmpDir, "intent.json");
    const mockPath = path.join(tmpDir, "mock.json");
    fs.writeFileSync(inputPath, buffer);
    fs.writeFileSync(
      intentPath,
      JSON.stringify({ primary_goal: "functional_strong" }),
    );
    fs.writeFileSync(mockPath, JSON.stringify(mockResponse));
    await runCli([
      "node",
      "slicer-copilot",
      "--intent-file",
      intentPath,
      "--mock-response",
      mockPath,
      "optimize",
      inputPath,
    ]);
    const expectedOutput = defaultOutputPath(inputPath);
    expect(fs.existsSync(expectedOutput)).toBe(true);
  });
});
