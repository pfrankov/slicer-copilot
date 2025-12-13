import { describe, expect, it } from "vitest";
import {
  ensureObjectOverride,
  makeObjectKey,
  readObjectOverride,
} from "../src/utils/objectOverrides.js";

describe("object override helpers", () => {
  it("builds keys and reuses existing override entries", () => {
    const overrides = {};
    expect(makeObjectKey("Obj", null)).toBe("Obj");
    expect(makeObjectKey("Obj", 2)).toBe("2::Obj");
    expect(makeObjectKey(undefined, null)).toBe("object");

    const ensured = ensureObjectOverride(overrides, {
      objectName: "Obj",
      plateIndex: 2,
    });
    ensured.adhesion_type = "raft";

    const read = readObjectOverride(overrides, {
      objectName: "Obj",
      plateIndex: 2,
    });
    expect(read.adhesion_type).toBe("raft");
    expect(
      ensureObjectOverride(overrides, {
        objectName: "Obj",
        plateIndex: 2,
      }),
    ).toBe(ensured);

    const defaulted = ensureObjectOverride(overrides, {
      objectName: undefined,
      plateIndex: null,
    });
    expect(
      readObjectOverride(overrides, {
        objectName: undefined,
        plateIndex: null,
      }),
    ).toBe(defaulted);
  });
});
