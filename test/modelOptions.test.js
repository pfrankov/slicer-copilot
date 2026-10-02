import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { buildModelOptions } from "../src/llm/modelOptions.js";

describe("model request options", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    "gpt-4.1-mini",
    "local-model",
    "custom-reasoning",
    "gpt-6.1-sol-custom",
    "toString",
  ])("preserves temperature without guessing capabilities for %s", (model) => {
    expect(buildModelOptions({ model, temperature: 0.3 })).toEqual({
      model,
      temperature: 0.3,
    });
  });

  it.each(["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna"])(
    "omits both effort and temperature for the API default of %s",
    (model) => {
      expect(buildModelOptions({ model, temperature: 0.3 })).toEqual({ model });
    },
  );

  it.each(["low", "medium", "high", "xhigh", "max"])(
    "sends explicit %s reasoning without temperature",
    (reasoningEffort) => {
      for (const model of ["gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna"]) {
        expect(
          buildModelOptions({ model, reasoningEffort, temperature: 0.3 }),
        ).toEqual({
          model,
          reasoning_effort: reasoningEffort,
        });
      }
    },
  );

  it.each(["gpt-6-sol", "gpt-6-luna"])(
    "sends explicit none and preserves temperature zero for %s",
    (model) => {
      expect(
        buildModelOptions({ model, reasoningEffort: "none", temperature: 0 }),
      ).toEqual({
        model,
        reasoning_effort: "none",
        temperature: 0,
      });
    },
  );

  it.each([
    ["gpt-6.1-sol", "none"],
    ["gpt-6.1-sol", "minimal"],
    ["gpt-6-sol", "off"],
    ["gpt-6-luna", ""],
    ["gpt-6-luna", "invalid"],
    ["gpt-4.1-mini", "medium"],
    ["local-model", "medium"],
    ["toString", "medium"],
  ])("rejects unsupported effort %s / %s", (model, reasoningEffort) => {
    expect(() =>
      buildModelOptions({ model, reasoningEffort, temperature: 0.3 }),
    ).toThrow(
      `Reasoning effort "${reasoningEffort}" is not supported for model "${model}".`,
    );
  });

  it("keeps the default model and leaves reasoning effort unset", () => {
    vi.stubEnv("OPENAI_MODEL", undefined);
    vi.stubEnv("OPENAI_REASONING_EFFORT", undefined);
    expect(loadConfig()).toMatchObject({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      reasoningEffort: undefined,
    });
  });

  it("lets explicit options override environment values, including none", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
    vi.stubEnv("OPENAI_REASONING_EFFORT", "high");
    expect(loadConfig()).toMatchObject({
      model: "gpt-6-luna",
      reasoningEffort: "high",
    });
    expect(
      loadConfig({ model: "gpt-6-sol", reasoningEffort: "none" }),
    ).toMatchObject({
      model: "gpt-6-sol",
      reasoningEffort: "none",
    });
  });
});
