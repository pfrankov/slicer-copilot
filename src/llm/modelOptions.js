const REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const SUPPORTED_MODELS = new Map([
  ["gpt-6.1-sol", REASONING_EFFORTS],
  ["gpt-6-sol", ["none", ...REASONING_EFFORTS]],
  ["gpt-6-luna", ["none", ...REASONING_EFFORTS]],
]);

/**
 * Build sampling/reasoning parameters for the documented model identifiers.
 * Unknown OpenAI-compatible models retain the existing temperature behavior.
 *
 * @param {object} config
 * @param {string} config.model
 * @param {number} config.temperature
 * @param {string} [config.reasoningEffort]
 * @returns {object}
 */
export function buildModelOptions({ model, temperature, reasoningEffort }) {
  const supportedEfforts = SUPPORTED_MODELS.get(model);
  if (
    reasoningEffort !== undefined &&
    !supportedEfforts?.includes(reasoningEffort)
  ) {
    throw new Error(
      `Reasoning effort "${reasoningEffort}" is not supported for model "${model}".`,
    );
  }

  const options = { model };
  if (reasoningEffort !== undefined) {
    options.reasoning_effort = reasoningEffort;
  }
  // These GPT-6 models default to medium reasoning when effort is omitted.
  if (!supportedEfforts || reasoningEffort === "none") {
    options.temperature = temperature;
  }
  return options;
}
