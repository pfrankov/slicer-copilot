export class InvalidLlmResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidLlmResponseError";
  }
}

/**
 * Parse and validate the optimizer response.
 *
 * Accepts either a raw JSON string or an already-parsed object and returns a
 * normalized shape expected by downstream code.
 *
 * @param {string | object} content
 * @returns {{ version: number, changes: Array<{ scope: string, target: any, parameter: string, newValue: any, changeType: string, reason: string }>, globalRationale: any, warnings: string[] }}
 */
export function parseLlmResponse(content) {
  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new InvalidLlmResponseError(
        `Invalid JSON from LLM: ${error.message}`,
      );
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new InvalidLlmResponseError("LLM response must be an object.");
  }
  if (!Array.isArray(parsed.changes)) {
    throw new InvalidLlmResponseError(
      "LLM response must include a changes array.",
    );
  }
  const validatedChanges = parsed.changes.map(validateChange);
  return {
    version: parsed.version ?? 1,
    changes: validatedChanges,
    globalRationale: parsed.globalRationale,
    warnings: parsed.warnings ?? [],
  };
}

function validateChange(change, index) {
  if (!change.parameter) {
    throw new InvalidLlmResponseError(
      `Change at index ${index} is missing parameter.`,
    );
  }
  if (change.newValue === undefined) {
    throw new InvalidLlmResponseError(
      `Change for ${change.parameter} is missing newValue.`,
    );
  }
  const scope = change.scope ?? "global";
  const allowedScopes = ["global", "object"];
  if (!allowedScopes.includes(scope)) {
    throw new InvalidLlmResponseError(
      `Unsupported scope ${scope} for change ${change.parameter}.`,
    );
  }

  return {
    scope,
    target: change.target ?? null,
    parameter: change.parameter,
    newValue: change.newValue,
    changeType: change.changeType ?? "absolute",
    reason: change.reason ?? "",
  };
}
