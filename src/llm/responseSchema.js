export const LLM_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "slicer_copilot_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        version: { type: ["number", "null"] },
        changes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              scope: { type: ["string", "null"], enum: ["global", "object"] },
              target: {
                type: "object",
                additionalProperties: false,
                properties: {
                  objectName: { type: ["string", "null"] },
                  plateIndex: { type: ["number", "null"] },
                },
                required: ["objectName", "plateIndex"],
              },
              parameter: { type: ["string", "null"] },
              newValue: { type: ["string", "number", "boolean", "null"] },
              changeType: {
                type: ["string", "null"],
                enum: ["absolute", "relative"],
              },
              reason: { type: ["string", "null"] },
            },
            required: [
              "scope",
              "target",
              "parameter",
              "newValue",
              "changeType",
              "reason",
            ],
          },
        },
        globalRationale: { type: ["string", "null"] },
        warnings: { type: ["array", "null"], items: { type: "string" } },
      },
      required: ["version", "changes", "globalRationale", "warnings"],
    },
  },
};
