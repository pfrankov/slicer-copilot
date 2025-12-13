import fs from "fs";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import { createI18n } from "../i18n.js";

// Use simple chalk colors to avoid import issues with figures
const ui = {
  primary: chalk.hex("#7AD7F0"),
  secondary: chalk.hex("#9DB7C7"),
  accent: chalk.hex("#F2C94C"),
  success: chalk.hex("#9AF2AE"),
  muted: chalk.dim,
  bold: chalk.bold.white,
  // Simple icons
  pointer: "›",
  check: "✓",
  star: "★",
};

/**
 * @typedef {object} IntentConstraints
 * @property {number | null} max_print_time_hours
 * @property {boolean} material_saving_important
 */

/**
 * @typedef {object} UserIntent
 * @property {string} primary_goal
 * @property {string[]} secondary_goals
 * @property {"low" | "medium" | "high" | string} tolerance_importance
 * @property {boolean} load_bearing
 * @property {boolean} safety_critical
 * @property {IntentConstraints} constraints
 * @property {string[]} locked_parameters
 * @property {string[]} preferred_focus
 * @property {string} free_text_description
 */

/**
 * Build a default intent used for non-interactive mode and as a merge base.
 *
 * @returns {UserIntent}
 */
export function createEmptyIntent() {
  return {
    primary_goal: "balanced",
    secondary_goals: [],
    tolerance_importance: "medium",
    load_bearing: false,
    safety_critical: false,
    constraints: {
      max_print_time_hours: null,
      material_saving_important: false,
    },
    locked_parameters: [],
    preferred_focus: [],
    free_text_description: "",
  };
}

/**
 * Read a user intent JSON file and normalize it to the supported shape.
 *
 * @param {string} path
 * @returns {UserIntent}
 */
export function readIntentFromFile(path) {
  const raw = fs.readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeIntent(parsed);
}

/**
 * Normalize user-provided intent, supporting legacy field aliases.
 *
 * @param {Partial<UserIntent> & Record<string, any>} intent
 * @returns {UserIntent}
 */
export function normalizeIntent(intentInput) {
  const base = createEmptyIntent();
  const intent = intentInput ?? {};
  const rest = { ...intent };
  delete rest.change_aggressiveness;
  delete rest.changeAggressiveness;
  return {
    ...base,
    ...rest,
    constraints: {
      ...base.constraints,
      ...(intent.constraints ?? {}),
    },
    secondary_goals:
      intent.secondary_goals ?? intent.secondaryGoals ?? base.secondary_goals,
    locked_parameters:
      intent.locked_parameters ??
      intent.lockedParameters ??
      base.locked_parameters,
    preferred_focus:
      intent.preferred_focus ?? intent.preferredFocus ?? base.preferred_focus,
    free_text_description:
      intent.free_text_description ??
      intent.description ??
      base.free_text_description,
  };
}

/**
 * Prompt the user for optimization intent (interactive TTY only).
 *
 * @param {object} [options]
 * @param {{ log?: (...args: any[]) => void } | undefined} [options.logger]
 * @param {NodeJS.ReadStream} [options.inputStream]
 * @param {NodeJS.WriteStream} [options.outputStream]
 * @param {boolean} [options.askForNotes]
 * @param {{ t: (key: string, vars?: Record<string, string | number>) => string }} [options.i18n]
 * @returns {Promise<UserIntent>}
 */
export async function promptIntent({
  logger,
  inputStream = input,
  outputStream = output,
  askForNotes = true,
  i18n = createI18n(),
} = {}) {
  const translator = i18n;
  const t = translator.t;
  const intent = createEmptyIntent();
  const options = [
    {
      value: "balanced",
      label: t("goalBalancedLabel"),
      icon: "",
      desc: t("goalBalancedDesc"),
    },
    {
      value: "functional_strong",
      label: t("goalFunctionalLabel"),
      icon: "",
      desc: t("goalFunctionalDesc"),
    },
    {
      value: "visual_quality",
      label: t("goalVisualLabel"),
      icon: "",
      desc: t("goalVisualDesc"),
    },
    {
      value: "draft_fast",
      label: t("goalDraftLabel"),
      icon: "",
      desc: t("goalDraftDesc"),
    },
    {
      value: "custom",
      label: t("goalCustomLabel"),
      icon: "",
      desc: t("goalCustomDesc"),
    },
  ];
  const question = `${ui.star} ${ui.bold(t("selectGoalPrompt"))} ${ui.muted("(↑/↓ + Enter)")}`;
  const selected = await selectOption({
    question,
    options,
    input: inputStream,
    output: outputStream,
  });
  intent.primary_goal = selected.value;
  intent.secondary_goals = [];
  intent.free_text_description = askForNotes
    ? await promptOptionalNotes({
        input: inputStream,
        output: outputStream,
        t,
      })
    : "";
  logger?.log?.(
    `${ui.check} ${ui.success(`${t("selectedLabel")}`)} ${ui.accent(selected.label)}`,
  );
  return intent;
}

function selectOption({
  question,
  options,
  input: inputStream,
  output: outputStream,
}) {
  return new Promise((resolve, reject) => {
    if (!inputStream.isTTY || typeof inputStream.setRawMode !== "function") {
      resolve(options[0]);
      return;
    }

    let index = 0;
    let rendered = false;
    const linesCount = options.length + 2; // +2 for question and spacing

    const render = () => {
      if (rendered) {
        readline.moveCursor(outputStream, 0, -linesCount);
      }
      readline.cursorTo(outputStream, 0);
      readline.clearScreenDown(outputStream);
      outputStream.write(`${question}\n\n`);
      options.forEach((opt, i) => {
        const isSelected = i === index;
        /* c8 ignore next */
        const icon = opt.icon ? `${opt.icon} ` : "";
        const label = isSelected
          ? ui.accent(opt.label)
          : ui.secondary(opt.label);
        /* c8 ignore next */
        const desc = opt.desc ? ` ${ui.muted(`— ${opt.desc}`)}` : "";
        const pointer = isSelected ? ui.primary(`${ui.pointer} `) : "  ";
        outputStream.write(
          `${pointer}${icon}${label}${isSelected ? desc : ""}\n`,
        );
      });
      rendered = true;
    };

    const onKey = (str, key = {}) => {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        cleanup();
        reject(new Error("User cancelled"));
        return;
      }
      if (key.name === "up") {
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (key.name === "down") {
        index = (index + 1) % options.length;
        render();
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(options[index]);
      }
    };

    const cleanup = () => {
      inputStream.removeListener("keypress", onKey);
      if (inputStream.isTTY && typeof inputStream.setRawMode === "function") {
        inputStream.setRawMode(false);
      }
      readline.cursorTo(outputStream, 0);
      readline.clearScreenDown(outputStream);
      outputStream.write("\n");
    };

    // Subscribe to keypress BEFORE enabling raw mode and emitting events
    inputStream.on("keypress", onKey);

    readline.emitKeypressEvents(inputStream);
    inputStream.setRawMode(true);
    inputStream.resume();

    render();
  });
}

function promptOptionalNotes({ input, output, t }) {
  /* c8 ignore start */
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      resolve("");
      return;
    }
    if (typeof input.setRawMode === "function") {
      input.setRawMode(false);
    }
    if (typeof input.resume === "function") {
      input.resume();
    }
    const rl = readline.createInterface({ input, output });
    const cleanup = (answer = "") => {
      rl.removeAllListeners();
      rl.close();
      resolve(answer.trim());
    };
    const prompt = `\n${ui.muted("📝")} ${ui.secondary(t("notesPromptLabel"))}\n${ui.muted(`   ${t("skipHint")}`)}\n${ui.primary(ui.pointer)} `;
    rl.setPrompt(prompt);
    rl.prompt();
    const start = Date.now();
    let discarded = false;
    rl.on("line", (answer) => {
      // Discard spurious empty line that may arrive from previous raw mode
      if (!discarded && answer === "" && Date.now() - start < 250) {
        discarded = true;
        rl.prompt();
        return;
      }
      cleanup(answer);
    });
    rl.on("SIGINT", () => {
      rl.removeAllListeners();
      rl.close();
      reject(new Error("User cancelled"));
    });
    rl.on("close", () => {
      rl.removeAllListeners();
      reject(new Error("User cancelled"));
    });
  });
  /* c8 ignore stop */
}
