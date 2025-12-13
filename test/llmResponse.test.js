import { describe, expect, it } from "vitest";
import {
  InvalidLlmResponseError,
  parseLlmResponse,
} from "../src/llm/responseValidator.js";

describe("parseLlmResponse", () => {
  it("parses valid response", () => {
    const json = JSON.stringify({
      version: 1,
      changes: [
        { scope: "global", parameter: "layer_height_mm", newValue: 0.18 },
      ],
      warnings: ["note"],
      globalRationale: "test",
    });
    const parsed = parseLlmResponse(json);
    expect(parsed.changes[0].parameter).toBe("layer_height_mm");
    expect(parsed.warnings[0]).toBe("note");
  });

  it("throws on invalid json", () => {
    expect(() => parseLlmResponse("{bad json}")).toThrow(
      InvalidLlmResponseError,
    );
  });

  it("throws on missing changes", () => {
    expect(() => parseLlmResponse("{}")).toThrow(InvalidLlmResponseError);
  });

  it("throws when response is not an object", () => {
    expect(() => parseLlmResponse(null)).toThrow(InvalidLlmResponseError);
  });

  it("requires parameter and newValue fields", () => {
    expect(() =>
      parseLlmResponse({ changes: [{ scope: "global", newValue: 1 }] }),
    ).toThrow(InvalidLlmResponseError);
    expect(() =>
      parseLlmResponse({ changes: [{ scope: "global", parameter: "x" }] }),
    ).toThrow(InvalidLlmResponseError);
  });

  it("throws on malformed change entries", () => {
    expect(() =>
      parseLlmResponse(
        JSON.stringify({
          changes: [
            { scope: "bad", parameter: "x", newValue: 1 },
            { newValue: 1 },
          ],
        }),
      ),
    ).toThrow(InvalidLlmResponseError);
    expect(() =>
      parseLlmResponse(
        JSON.stringify({ changes: [{ scope: "global", parameter: "x" }] }),
      ),
    ).toThrow(InvalidLlmResponseError);
  });

  it("defaults scope to global when omitted", () => {
    const parsed = parseLlmResponse({
      changes: [{ parameter: "fan_speed_percent", newValue: 80 }],
    });
    expect(parsed.changes[0].scope).toBe("global");
  });
});
