import fs from "fs";
import path from "path";
import { Command } from "commander";
import ora from "ora";
import { createLogger } from "./logger.js";
import { loadConfig } from "./config.js";
import { parse3mfFile } from "./3mf/parser.js";
import { updateMetadataFromNormalized, write3mf } from "./3mf/writer.js";
import { buildLlmRequestPayload } from "./llm/requestBuilder.js";
import { requestOptimization } from "./llm/optimizerClient.js";
import { SYSTEM_PROMPT } from "./llm/prompt.js";
import { applyLlmChanges } from "./apply/changes.js";
import {
  summarizeProject,
  formatDiffs,
  formatRationale,
  formatJsonForConsole,
  formatWarnings,
  formatSuccess,
  formatError,
  palette,
  figures,
} from "./utils/summary.js";
import {
  createEmptyIntent,
  promptIntent,
  readIntentFromFile,
} from "./intent/intent.js";
import { createI18n } from "./i18n.js";

/**
 * CLI entry point (used by `bin/slicer-copilot` and tests).
 *
 * @param {string[]} [argv]
 * @returns {Promise<void>}
 */
export async function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name("slicer-copilot")
    .description(
      "Slicer Copilot: optimize Bambu Studio .3mf print settings via LLM",
    )
    .option("-o, --output <file>", "Output .3mf path")
    .option("--dry-run", "Run without writing output", false)
    .option("--non-interactive", "Skip interactive prompts", false)
    .option("--intent-file <file>", "JSON file with user intent")
    .option("--verbose", "Verbose logging", false)
    .option("--model <model>", "LLM model name")
    .option("--base-url <url>", "OpenAI-compatible base URL")
    .option("--api-key <key>", "API key (or use env)")
    .option("--temperature <number>", "Temperature for LLM", parseFloat)
    .option("--mock-response <file>", "Use mock LLM JSON response (for tests)")
    .option(
      "-f, --force",
      "Allow changing settings already modified in the .3mf",
      false,
    )
    .option(
      "--language <code>",
      "Language for CLI output and model replies (e.g. en, ru, es)",
    )
    .command("optimize <input>")
    .action(async (input, _opts, cmd) => {
      const options = cmd.parent.opts();
      const logger = createLogger(options.verbose);
      try {
        await handleOptimize({ input, options, logger });
      } catch (error) {
        logger.log("");
        logger.log(formatError(`Error: ${error.message}`));
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv);
}

/**
 * Resolve user intent from `--intent-file`, non-interactive defaults, or
 * interactive prompts.
 *
 * @param {object} options
 * @param {{ log?: (...args: any[]) => void } | undefined} logger
 * @param {{ t: (key: string, vars?: Record<string, string | number>) => string }} [i18n]
 * @returns {Promise<object>}
 */
export async function loadIntent(options, logger, i18n = createI18n()) {
  const translator = i18n ?? createI18n();
  if (options.intentFile) {
    return readIntentFromFile(options.intentFile);
  }
  if (options.nonInteractive) {
    logger?.log?.(translator.t("nonInteractiveIntent"));
    return createEmptyIntent();
  }
  return promptIntent({ logger, i18n: translator });
}

/**
 * Compute the default output path for an input file.
 *
 * @param {string} input
 * @returns {string}
 */
export function defaultOutputPath(input) {
  const parsed = path.parse(input);
  const extIs3mf = parsed.ext.toLowerCase() === ".3mf";
  const baseName = extIs3mf ? parsed.name : parsed.base;
  const targetFile = `${baseName}.optimized${extIs3mf ? parsed.ext : ".3mf"}`;
  return path.join(parsed.dir || ".", targetFile);
}

async function handleOptimize({ input, options, logger }) {
  const config = loadConfig({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
    model: options.model,
    temperature: options.temperature,
    mockResponsePath: options.mockResponse,
  });
  const language =
    options.language ??
    process.env.SLICER_COPILOT_LANGUAGE ??
    process.env.SLICER_COPILOT_LANG ??
    "en";
  const i18n = createI18n(language);

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  // Parse .3mf file with spinner
  const parseSpinner = ora({
    text: palette.text(i18n.t("loadingProject")),
    spinner: "dots",
    color: "cyan",
  }).start();

  let parsed;
  try {
    parsed = await parse3mfFile(input);
    parseSpinner.succeed(palette.success(i18n.t("projectLoaded")));
  } catch (err) {
    parseSpinner.fail(palette.error(i18n.t("projectParseFailed")));
    throw err;
  }

  logger.log("");
  logger.log(summarizeProject(parsed.normalized, i18n));

  const intent = await loadIntent(options, logger, i18n);
  const payload = buildLlmRequestPayload({
    normalized: parsed.normalized,
    userIntent: intent,
    plateImages: parsed.plateImages,
    allowUserSettingOverrides:
      options.force === true || options.overrideUserSettings === true,
    targetLanguage: i18n.language,
  });

  if (options.verbose) {
    logger.log("");
    logger.debug(
      `${figures.info} ${palette.muted(i18n.t("llmSystemPromptLabel"))}`,
    );
    logger.debug(SYSTEM_PROMPT);
    logger.log("");
    logger.debug(
      `${figures.info} ${palette.muted(i18n.t("llmRequestPayloadLabel"))}`,
    );
    logger.debug(formatJsonForConsole(payload));
    logger.log("");
  }

  // Call LLM with spinner
  const llmSpinner = ora({
    text: palette.text(i18n.t("analyzingSettings")),
    spinner: "dots",
    color: "yellow",
  }).start();

  let llmResponse;
  try {
    llmResponse = await requestOptimization({
      payload,
      config,
      logger: { log: () => {}, debug: () => {} }, // Suppress logs during spinner
    });
    llmSpinner.succeed(palette.success(i18n.t("analysisComplete")));
  } catch (err) {
    llmSpinner.fail(palette.error(i18n.t("analysisFailed")));
    throw err;
  }

  const { updated, warnings, diffs } = applyLlmChanges({
    normalized: parsed.normalized,
    response: llmResponse,
    respectUserSettings:
      options.force !== true && options.overrideUserSettings !== true,
    i18n,
  });

  logger.log("");
  logger.log(formatDiffs(diffs, i18n));

  // Show rationale if provided
  const rationaleOutput = formatRationale(llmResponse.globalRationale, i18n);
  if (rationaleOutput) {
    logger.log(rationaleOutput);
  }

  // Format and display warnings
  if (warnings.length > 0) {
    logger.log(formatWarnings(warnings, i18n));
  }

  if (options.dryRun) {
    logger.log("");
    logger.log(`${figures.info} ${palette.muted(i18n.t("dryRunComplete"))}`);
    return;
  }

  const outputPath = options.output ?? defaultOutputPath(input);
  const nextMetadata = updateMetadataFromNormalized(parsed.metadata, updated);
  const toWrite = {
    ...parsed,
    metadata: nextMetadata,
    normalized: updated,
  };

  // Write file with spinner
  const writeSpinner = ora({
    text: palette.text(i18n.t("writingOutput")),
    spinner: "dots",
    color: "green",
  }).start();

  try {
    await write3mf(toWrite, outputPath);
    writeSpinner.stop();
    logger.log("");
    logger.log(formatSuccess(i18n.t("writeSuccess", { path: outputPath })));
  } catch (err) {
    writeSpinner.fail(palette.error(i18n.t("writeFailed")));
    throw err;
  }
}
