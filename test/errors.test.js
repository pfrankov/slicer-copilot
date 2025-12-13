import { describe, expect, it } from "vitest";
import { FileFormatError } from "../src/errors.js";

describe("FileFormatError", () => {
  it("defaults message when not provided", () => {
    const error = new FileFormatError({ path: "bad.json" });
    expect(error.message).toContain("bad.json");
    expect(error.name).toBe("FileFormatError");
    expect(error.path).toBe("bad.json");
  });

  it("accepts custom message", () => {
    const error = new FileFormatError({ path: "bad.json", message: "oops" });
    expect(error.message).toBe("oops");
  });
});
