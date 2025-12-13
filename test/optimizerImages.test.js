import { afterEach, describe, expect, it, vi } from "vitest";

describe("optimizerClient plate images", () => {
  afterEach(() => {
    vi.doUnmock("openai");
    vi.resetModules();
  });

  it("sends plate previews as image_url entries without duplicating the data URL in text payload", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '{"version":1,"changes":[],"globalRationale":"ok","warnings":[]}',
          },
        },
      ],
    });
    vi.doMock("openai", () => ({
      default: vi.fn(() => ({
        chat: { completions: { create } },
      })),
    }));
    const { requestOptimization } =
      await import("../src/llm/optimizerClient.js");

    const imageDataUrl = "data:image/png;base64,abc123";
    const payload = {
      version: 1,
      projectSummary: {
        fileName: "demo.3mf",
        printer: {
          name: "X1",
          nozzle_diameter_mm: 0.4,
        },
        filaments: [],
        base_profile: null,
        plates: [],
      },
      currentSettings: { globalProcess: {}, perObjectOverrides: {} },
      intentDetails: {
        primary_goal: "functional_strong",
        secondary_goals: [],
        constraints: {
          max_print_time_hours: null,
          material_saving_important: false,
        },
        load_bearing: false,
        safety_critical: false,
        locked_parameters: [],
        preferred_focus: [],
        free_text_description: "",
      },
      plateImages: [
        { plateIndex: 0, name: "plate_0.png", dataUrl: imageDataUrl },
      ],
    };

    await requestOptimization({
      payload,
      config: { apiKey: "k", model: "gpt-4.1-mini", temperature: 0.3 },
      logger: { debug: () => {} },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const callArgs = create.mock.calls[0][0];
    const userMessage = callArgs.messages[1];
    const imageParts = userMessage.content.filter(
      (item) => item.type === "image_url",
    );
    expect(imageParts).toHaveLength(1);
    expect(imageParts[0].image_url).toEqual({
      url: imageDataUrl,
      detail: "low",
    });

    const textParts = userMessage.content.filter(
      (item) => item.type === "text",
    );
    const combinedText = textParts.map((item) => item.text).join(" ");
    expect(combinedText).not.toContain(imageDataUrl);

    const structured = textParts.find((item) =>
      item.text.startsWith("Structured project data (JSON):"),
    );
    const structuredJson = structured.text.replace(
      "Structured project data (JSON):\n",
      "",
    );
    const parsed = JSON.parse(structuredJson);
    expect(parsed).not.toHaveProperty("plateImages");
  });
});
