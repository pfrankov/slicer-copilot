import { describe, expect, it } from "vitest";
import {
  ALLOWED_EXTRA_CONFIG_KEYS,
  GLOBAL_PROCESS_MAPPINGS,
  SPEED_MAPPINGS,
} from "../src/3mf/configMapping.js";
import { SYSTEM_PROMPT } from "../src/llm/prompt.js";

function extractPromptParams(prompt) {
  const matches = [...prompt.matchAll(/`([^`]+)`/g)];
  return new Set(matches.map(([, name]) => name));
}

function mappedParams() {
  return new Set([
    ...GLOBAL_PROCESS_MAPPINGS.map((mapping) => mapping.targetKey),
    ...SPEED_MAPPINGS.map((mapping) => `speeds.${mapping.speedKey}`),
    ...ALLOWED_EXTRA_CONFIG_KEYS,
  ]);
}

describe("prompt mapping sync", () => {
  it("lists every mapped config parameter in the system prompt", () => {
    const promptParams = extractPromptParams(SYSTEM_PROMPT);
    const expectedParams = mappedParams();
    const missing = [...expectedParams].filter(
      (param) => !promptParams.has(param),
    );

    expect(
      missing,
      `Prompt is missing mapped parameters: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
