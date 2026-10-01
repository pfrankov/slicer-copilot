import "dotenv/config";
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE } from "./constants.js";
import { resolveReasoningEffort } from "./llm/modelOptions.js";

/**
 * @typedef {object} SlicerCopilotConfig
 * @property {string} apiKey
 * @property {string | undefined} baseURL
 * @property {string} model
 * @property {number} temperature
 * @property {"low" | "medium" | "high" | undefined} reasoningEffort
 * @property {string | undefined} mockResponsePath
 */

/**
 * Load Slicer Copilot runtime configuration from explicit options and/or env vars.
 *
 * @param {object} [options]
 * @param {string} [options.apiKey]
 * @param {string} [options.baseURL]
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {string} [options.reasoningEffort]
 * @param {string} [options.mockResponsePath]
 * @returns {SlicerCopilotConfig}
 */
export function loadConfig(options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const baseURL = options.baseURL ?? process.env.OPENAI_BASE_URL ?? undefined;
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const reasoningEffort = resolveReasoningEffort(
    options.reasoningEffort ?? process.env.OPENAI_REASONING_EFFORT,
  );
  const mockResponsePath =
    options.mockResponsePath ?? process.env.LLM_MOCK_RESPONSE;

  return {
    apiKey,
    baseURL,
    model,
    temperature,
    reasoningEffort,
    mockResponsePath,
  };
}
