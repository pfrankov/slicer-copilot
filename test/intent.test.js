import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "stream";
import { promptIntent, normalizeIntent } from "../src/intent/intent.js";

describe("intent helpers", () => {
  it("prompts with arrow navigation and selects option", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    const setRawMode = vi.fn();
    input.setRawMode = setRawMode;
    const output = new PassThrough();
    const log = vi.fn();
    const promise = promptIntent({
      logger: { log },
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    // Down arrow moves from balanced (index 0) to functional_strong (index 1)
    input.emit("data", Buffer.from("\u001b[B"));
    input.emit("data", Buffer.from("\r"));
    input.emit("data", Buffer.from("\n"));
    const intent = await promise;
    expect(intent.primary_goal).toBe("functional_strong");
    expect(setRawMode).toHaveBeenCalledWith(true);
    expect(setRawMode).toHaveBeenCalledWith(false);
    expect(log).toHaveBeenCalled();
  });

  it("falls back to default when not a TTY", async () => {
    const input = new PassThrough();
    input.isTTY = false;
    input.setRawMode = vi.fn();
    const intent = await promptIntent({
      logger: null,
      inputStream: input,
      outputStream: new PassThrough(),
      askForNotes: false,
    });
    expect(intent.primary_goal).toBe("balanced");
  });

  it("handles up arrow navigation", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    input.setRawMode = vi.fn();
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    input.emit("data", Buffer.from("\u001b[A"));
    input.emit("data", Buffer.from("\r"));
    input.emit("data", Buffer.from("\n"));
    const intent = await promise;
    expect(intent.primary_goal).toBe("custom");
  });

  it("accepts newline without arrows", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    const setRawMode = vi.fn();
    input.setRawMode = setRawMode;
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    input.emit("data", Buffer.from("\n"));
    input.emit("data", Buffer.from("\n"));
    const intent = await promise;
    expect(intent.primary_goal).toBe("balanced");
    expect(setRawMode).toHaveBeenCalledWith(true);
    expect(setRawMode).toHaveBeenCalledWith(false);
  });

  it("cleans up listeners after prompt completes", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    const setRawMode = vi.fn();
    input.setRawMode = setRawMode;
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    input.emit("data", Buffer.from("\r"));
    input.emit("data", Buffer.from("\n"));
    await promise;
    expect(input.listenerCount("data")).toBe(0);
    expect(input.listenerCount("keypress")).toBe(0);
    expect(setRawMode).toHaveBeenCalledWith(false);
  });

  it("collects optional notes when enabled", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    input.setRawMode = vi.fn();
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: true,
    });
    input.emit("data", Buffer.from("\r"));
    setTimeout(() => {
      input.emit("data", Buffer.from("fragile wing\n"));
    }, 5);
    const intent = await promise;
    expect(intent.free_text_description).toBe("fragile wing");
  });

  it("skips optional notes when stdin is not a TTY", async () => {
    const input = new PassThrough();
    input.isTTY = false;
    input.setRawMode = vi.fn();
    const intent = await promptIntent({
      logger: null,
      inputStream: input,
      outputStream: new PassThrough(),
      askForNotes: true,
    });
    expect(intent.free_text_description).toBe("");
  });

  it("normalizes casing and alternative names", () => {
    const intent = normalizeIntent({
      secondaryGoals: ["draft_fast"],
      lockedParameters: ["nozzle_temp_c"],
      preferredFocus: ["speed"],
      description: "test",
    });
    expect(intent.secondary_goals).toEqual(["draft_fast"]);
    expect(intent.locked_parameters).toEqual(["nozzle_temp_c"]);
    expect(intent.preferred_focus).toEqual(["speed"]);
    expect(intent.free_text_description).toBe("test");
  });

  it("ignores change_aggressiveness and defaults when intent is missing", () => {
    const missing = normalizeIntent(null);
    expect(missing.primary_goal).toBe("balanced");
    expect(missing).not.toHaveProperty("change_aggressiveness");

    const provided = normalizeIntent({
      primary_goal: "visual_quality",
      change_aggressiveness: "aggressive",
    });
    expect(provided.primary_goal).toBe("visual_quality");
    expect(provided).not.toHaveProperty("change_aggressiveness");
  });

  it("rejects on Ctrl+C during selection", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    input.setRawMode = vi.fn();
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    input.emit("keypress", "\x03", { ctrl: true, name: "c" });
    await expect(promise).rejects.toThrow("User cancelled");
  });

  it("rejects on Ctrl+D during selection", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    input.setRawMode = vi.fn();
    const output = new PassThrough();
    const promise = promptIntent({
      logger: null,
      inputStream: input,
      outputStream: output,
      askForNotes: false,
    });
    input.emit("keypress", "\x04", { ctrl: true, name: "d" });
    await expect(promise).rejects.toThrow("User cancelled");
  });
});
