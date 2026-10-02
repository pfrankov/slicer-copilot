import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { requestOptimization } from "../src/llm/optimizerClient.js";
import { loadConfig } from "../src/config.js";
import { runCli } from "../src/cli.js";
import { createSample3mf } from "./fixtures/sample3mf.js";
import { LLM_RESPONSE_FORMAT } from "../src/llm/responseSchema.js";

describe("optimizer HTTP serialization", () => {
  const requests = [];
  const payload = {
    version: 1,
    projectSummary: { fileName: "fixture.3mf", printer: {}, filaments: [] },
    currentSettings: { globalProcess: {}, perObjectOverrides: {} },
    intentDetails: {
      primary_goal: "balanced",
      locked_parameters: ["wall_line_count"],
    },
    allowUserSettingOverrides: true,
    plateImages: [
      { name: "plate.png", dataUrl: "data:image/png;base64,Zml4dHVyZQ==" },
    ],
  };
  let server;
  let baseURL;

  beforeEach(() => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", undefined);
    vi.stubEnv("LLM_MOCK_RESPONSE", undefined);
  });

  beforeAll(async () => {
    server = http.createServer(async (request, response) => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      requests.push({ path: request.url, body });
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  version: 1,
                  changes: [],
                  globalRationale: "fixture",
                  warnings: [],
                }),
              },
            },
          ],
        }),
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseURL = `http://127.0.0.1:${server.address().port}/v1`;
  });

  afterEach(() => {
    requests.length = 0;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it.each([
    ["gpt-4.1-mini", undefined, 0.3],
    ["gpt-6.1-sol", undefined, undefined],
    ["gpt-6.1-sol", "medium", undefined],
    ["gpt-6-sol", undefined, undefined],
    ["gpt-6-sol", "none", 0.3],
    ["gpt-6-luna", "max", undefined],
    ["gpt-6-luna", "none", 0.3],
  ])(
    "serializes %s with effort %s",
    async (model, reasoningEffort, temperature) => {
      const config = loadConfig({
        apiKey: "local-test-dummy",
        baseURL,
        model,
        reasoningEffort,
      });
      await expect(
        requestOptimization({ payload, config }),
      ).resolves.toMatchObject({ changes: [] });
      expect(requests).toHaveLength(1);
      const { body } = requests[0];
      expect(requests[0].path).toBe("/v1/chat/completions");
      expect(body.model).toBe(model);
      if (reasoningEffort === undefined)
        expect(body).not.toHaveProperty("reasoning_effort");
      else expect(body.reasoning_effort).toBe(reasoningEffort);
      if (temperature === undefined)
        expect(body).not.toHaveProperty("temperature");
      else expect(body.temperature).toBe(temperature);
      expect(body.response_format).toEqual(LLM_RESPONSE_FORMAT);
      expect(body).not.toHaveProperty("tools");
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].content).toContainEqual({
        type: "image_url",
        image_url: { url: payload.plateImages[0].dataUrl, detail: "low" },
      });
      expect(JSON.stringify(body.messages)).toContain(
        "locked_parameters: wall_line_count",
      );
    },
  );

  it("rejects unsupported none without sending an HTTP request", async () => {
    const config = loadConfig({
      apiKey: "local-test-dummy",
      baseURL,
      model: "gpt-6.1-sol",
      reasoningEffort: "none",
    });
    await expect(requestOptimization({ payload, config })).rejects.toThrow(
      'Reasoning effort "none" is not supported',
    );
    expect(requests).toHaveLength(0);
  });

  it("forwards the CLI option ahead of the environment to the real SDK", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slicer-http-"));
    const input = path.join(directory, "input.3mf");
    const { buffer } = await createSample3mf();
    fs.writeFileSync(input, buffer);
    vi.stubEnv("OPENAI_REASONING_EFFORT", "high");
    vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runCli([
        "node",
        "slicer-copilot",
        "--non-interactive",
        "--dry-run",
        "--api-key",
        "local-test-dummy",
        "--base-url",
        baseURL,
        "--model",
        "gpt-6-sol",
        "--reasoning-effort",
        "none",
        "optimize",
        input,
      ]);
      expect(process.exitCode ?? 0).toBe(0);
      expect(requests).toHaveLength(1);
      expect(requests[0].body).toMatchObject({
        model: "gpt-6-sol",
        reasoning_effort: "none",
        temperature: 0.3,
      });
      expect(fs.existsSync(path.join(directory, "input.optimized.3mf"))).toBe(
        false,
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
