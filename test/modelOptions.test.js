import { describe, expect, it } from "vitest";
import {
  buildChatCompletionBody,
  buildOptimizationContext,
  modelSupportsReasoning,
  plateImageDetailLevel,
  resolveReasoningEffort,
} from "../src/llm/modelOptions.js";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TEMPERATURE,
} from "../src/constants.js";

describe("modelOptions", () => {
  it("detects reasoning-capable models", () => {
    expect(modelSupportsReasoning("gpt-6.1-sol")).toBe(true);
    expect(modelSupportsReasoning("o3-mini")).toBe(true);
    expect(modelSupportsReasoning("gpt-5-preview")).toBe(true);
    expect(modelSupportsReasoning("my-reasoning-model")).toBe(true);
    expect(modelSupportsReasoning("gpt-4.1-mini")).toBe(false);
    expect(modelSupportsReasoning("")).toBe(false);
    expect(modelSupportsReasoning(undefined)).toBe(false);
  });

  it("resolves reasoning effort with defaults and disable values", () => {
    expect(resolveReasoningEffort(undefined)).toBe(DEFAULT_REASONING_EFFORT);
    expect(resolveReasoningEffort("high")).toBe("high");
    expect(resolveReasoningEffort("none")).toBeUndefined();
    expect(resolveReasoningEffort("off")).toBeUndefined();
    expect(resolveReasoningEffort("")).toBeUndefined();
    expect(() => resolveReasoningEffort("turbo")).toThrow(/Invalid reasoning effort/);
  });

  it("builds chat completion bodies for reasoning vs classic models", () => {
    expect(
      buildChatCompletionBody({
        model: DEFAULT_MODEL,
        temperature: 0.3,
        reasoningEffort: "medium",
      }),
    ).toEqual({
      model: DEFAULT_MODEL,
      reasoning_effort: "medium",
    });
    expect(
      buildChatCompletionBody({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        reasoningEffort: "medium",
      }),
    ).toEqual({
      model: "gpt-4.1-mini",
      temperature: 0.2,
    });
    expect(
      buildChatCompletionBody({
        temperature: 0.25,
        reasoningEffort: undefined,
      }),
    ).toEqual({
      model: DEFAULT_MODEL,
      temperature: 0.25,
    });
    expect(
      buildChatCompletionBody({
        model: "gpt-4.1-mini",
        reasoningEffort: undefined,
      }),
    ).toEqual({
      model: "gpt-4.1-mini",
      temperature: DEFAULT_TEMPERATURE,
    });
  });

  it("builds optimization context from normalized project data", () => {
    const context = buildOptimizationContext({
      projectSummary: {
        printer: { nozzle_diameter_mm: 0.4 },
        filaments: [{ material_family: "PLA" }, { material_family: "PLA" }],
      },
    });
    expect(context.nozzle_diameter_mm).toBe(0.4);
    expect(context.layer_height_mm_range).toEqual([0.05, 0.32]);
    expect(context.material_safe_ranges.PLA).toBeDefined();

    const fallbackMaterial = buildOptimizationContext({
      projectSummary: {
        printer: {},
        filaments: [{ material_family: "Exotic" }],
      },
    });
    expect(fallbackMaterial.nozzle_diameter_mm).toBe(0.4);
    expect(fallbackMaterial.material_safe_ranges.Exotic).toBeDefined();

    const defaultRanges = buildOptimizationContext({});
    expect(defaultRanges.material_safe_ranges.default).toBeDefined();
  });

  it("chooses plate image detail based on goal", () => {
    expect(plateImageDetailLevel({ primary_goal: "draft_fast" })).toBe("low");
    expect(plateImageDetailLevel({ primary_goal: "visual_quality" })).toBe(
      "high",
    );
    expect(plateImageDetailLevel(undefined)).toBe("high");
  });
});
