import chalk from "chalk";
import Table from "cli-table3";
import boxen from "boxen";
import figures from "figures";
import { createI18n } from "../i18n.js";

const MIN_TERMINAL_WIDTH = 72;

// Professional color palette - inspired by modern CLI tools
const palette = {
  // Primary colors
  primary: chalk.hex("#7AD7F0"),
  secondary: chalk.hex("#9DB7C7"),
  accent: chalk.hex("#F2C94C"),
  success: chalk.hex("#9AF2AE"),
  warning: chalk.hex("#FFB347"),
  error: chalk.hex("#FF6B6B"),
  info: chalk.hex("#74B9FF"),

  // Text variants
  text: chalk.white,
  muted: chalk.dim,
  bold: chalk.bold.white,

  // Semantic colors
  heading: chalk.bold.hex("#7AD7F0"),
  label: chalk.hex("#9DB7C7"),
  value: chalk.white,
  highlight: chalk.bold.hex("#F2C94C"),

  // JSON syntax highlighting
  jsonKey: chalk.hex("#74B9FF"),
  jsonString: chalk.hex("#9AF2AE"),
  jsonNumber: chalk.hex("#F2C94C"),
  jsonBoolean: chalk.hex("#FFB347"),
  jsonNull: chalk.dim,

  // Diff colors
  diffOld: chalk.hex("#FF6B6B").strikethrough,
  diffNew: chalk.bold.hex("#9AF2AE"),
  diffArrow: chalk.hex("#74B9FF"),
};

// Unicode box-drawing characters for premium look
const boxChars = {
  rounded: {
    top: "─",
    "top-mid": "┬",
    "top-left": "╭",
    "top-right": "╮",
    bottom: "─",
    "bottom-mid": "┴",
    "bottom-left": "╰",
    "bottom-right": "╯",
    left: "│",
    "left-mid": "├",
    mid: "─",
    "mid-mid": "┼",
    right: "│",
    "right-mid": "┤",
    middle: "│",
  },
  double: {
    top: "═",
    "top-mid": "╤",
    "top-left": "╔",
    "top-right": "╗",
    bottom: "═",
    "bottom-mid": "╧",
    "bottom-left": "╚",
    "bottom-right": "╝",
    left: "║",
    "left-mid": "╟",
    mid: "─",
    "mid-mid": "┼",
    right: "║",
    "right-mid": "╢",
    middle: "│",
  },
  heavy: {
    top: "━",
    "top-mid": "┳",
    "top-left": "┏",
    "top-right": "┓",
    bottom: "━",
    "bottom-mid": "┻",
    "bottom-left": "┗",
    "bottom-right": "┛",
    left: "┃",
    "left-mid": "┣",
    mid: "━",
    "mid-mid": "╋",
    right: "┃",
    "right-mid": "┫",
    middle: "┃",
  },
};

// Column weight configurations
const summaryWeights = [0.32, 0.68];
const diffWeights = [0.32, 0.28, 0.4];
const diffMinimums = [22, 20, 26];

const defaultI18n = createI18n();

/**
 * Get current terminal width with a sensible minimum
 */
function terminalWidth() {
  const width = process?.stdout?.columns ?? MIN_TERMINAL_WIDTH;
  return Math.max(width, MIN_TERMINAL_WIDTH);
}

/**
 * Distribute column widths proportionally based on weights
 */
function distributeWidths(weights, minimums, width = terminalWidth()) {
  const sumWeights = weights.reduce((acc, weight) => acc + weight, 0);
  const minimumWidth = minimums.reduce((acc, value) => acc + value, 0);
  const borderAllowance = weights.length * 3 + 1;
  const available = Math.max(width - borderAllowance, minimumWidth);
  const computed = weights.map((weight, index) =>
    Math.max(minimums[index], Math.floor((available * weight) / sumWeights)),
  );
  const used = computed.reduce((acc, value) => acc + value, 0);
  computed[computed.length - 1] += available - used;
  return computed;
}

/**
 * Stringify a value for display
 */
function stringifyValue(value) {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * Format a change from old to new value with visual arrow
 */
function formatChange(from, to) {
  const fromValue = stringifyValue(from) || "—";
  const toValue = stringifyValue(to) || "—";
  return `${palette.diffOld(fromValue)} ${palette.diffArrow("→")} ${palette.diffNew(toValue)}`;
}

/**
 * Format parameter with optional object scope indicator
 */
function formatParameter(diff, i18n = defaultI18n) {
  const param = palette.accent(diff.parameter);
  if (diff.scope === "global") {
    return param;
  }
  // For object-scoped changes, show target below parameter
  const { objectName, plateIndex } = diff.target ?? {};
  const name = objectName ?? i18n.t("objectLabel");
  const plate = plateIndex ?? "?";
  const target = `${figures.triangleRight} ${palette.muted(name)}${palette.muted(`@p${plate}`)}`;
  return `${param}\n${target}`;
}

/**
 * Build a styled table with consistent theme
 */
function buildTable({ head, colWidths, theme = "rounded" }) {
  /* c8 ignore next */
  const chars = boxChars[theme] || boxChars.rounded;
  return new Table({
    head,
    colWidths,
    chars,
    style: {
      head: [],
      border: [],
      "padding-left": 1,
      "padding-right": 1,
      compact: false,
    },
    wordWrap: true,
  });
}

/**
 * Create a decorative header box
 */
export function createHeader(title, subtitle = "") {
  const content = subtitle
    ? `${palette.bold(title)}\n${palette.muted(subtitle)}`
    : palette.bold(title);

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "#7AD7F0",
    title: `${figures.star} Slicer Copilot`,
    titleAlignment: "left",
  });
}

/**
 * Create a status message with icon
 */
export function statusMessage(type, message) {
  const icons = {
    success: chalk.hex("#9AF2AE")(figures.tick),
    warning: chalk.hex("#FFB347")(figures.warning),
    error: chalk.hex("#FF6B6B")(figures.cross),
    info: chalk.hex("#74B9FF")(figures.info),
    pending: chalk.hex("#7AD7F0")(figures.pointer),
  };
  const icon = icons[type] || icons.info;
  return `${icon} ${message}`;
}

/**
 * Summarize the project with a professional table layout
 */
export function summarizeProject(normalized, i18n = defaultI18n) {
  const t = i18n.t;
  const { printer, filaments, plates, base_profile } =
    normalized.projectSummary;
  const settings = normalized.currentSettings.globalProcess ?? {};
  const colWidths = distributeWidths(summaryWeights, [18, 36]);

  const table = buildTable({
    head: [
      palette.heading(`${figures.info} ${t("fieldHeading")}`),
      palette.heading(`${figures.arrowRight} ${t("detailsHeading")}`),
    ],
    colWidths,
    theme: "rounded",
  });

  // File info
  table.push([
    palette.label(`${figures.squareSmallFilled} ${t("fileLabel")}`),
    palette.value(normalized.fileName),
  ]);

  // Printer info with details
  const printerInfo = [
    printer.name,
    `${figures.bullet} ${printer.nozzle_diameter_mm}mm nozzle`,
    printer.bed_type
      ? `${figures.bullet} ${t("bedLabel")}: ${printer.bed_type}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  table.push([
    palette.label(`${figures.play} ${t("printerLabel")}`),
    palette.value(printerInfo),
  ]);

  // Filaments with material badges
  const filamentStr =
    filaments
      .map((f) => {
        const badge = palette.accent(`[${f.material_family}]`);
        return `${f.name} ${badge}`;
      })
      .join(", ") || palette.muted(t("unknownValue"));
  table.push([
    palette.label(`${figures.circleFilled} ${t("filamentLabel")}`),
    filamentStr,
  ]);

  // Plates and objects count
  if (plates.length > 0) {
    const objectCount = plates.reduce((acc, p) => acc + p.objects.length, 0);
    const platesStr = `${t("layoutCounts", {
      plates: plates.length,
      objects: objectCount,
    })}`;
    table.push([
      palette.label(`${figures.lozenge} ${t("layoutLabel")}`),
      palette.value(platesStr),
    ]);
  }

  // Base profile
  table.push([
    palette.label(`${figures.pointer} ${t("profileLabel")}`),
    palette.value(base_profile ?? palette.muted(t("profileUnknown"))),
  ]);

  // Key process settings - formatted nicely
  const processDetails = [
    settings.layer_height_mm
      ? t("processLayerDetail", {
          value: palette.highlight(settings.layer_height_mm),
        })
      : null,
    settings.wall_line_count
      ? t("processWallsDetail", {
          value: palette.highlight(settings.wall_line_count),
        })
      : null,
    settings.infill_density_percent !== undefined
      ? t("processInfillDetail", {
          value: palette.highlight(settings.infill_density_percent),
        })
      : null,
    settings.infill_pattern ? palette.muted(settings.infill_pattern) : null,
  ]
    .filter(Boolean)
    .join(" │ ");

  table.push([
    palette.label(`${figures.hamburger} ${t("processLabel")}`),
    processDetails,
  ]);

  // Create header and combine
  const header = createHeader(t("projectSummaryTitle"), normalized.fileName);
  return `${header}${table.toString()}`;
}

/**
 * Format diffs as a professional table
 */
export function formatDiffs(diffs, i18n = defaultI18n) {
  const t = i18n.t;
  if (diffs.length === 0) {
    return boxen(`${figures.tick} ${palette.success(t("noChangesApplied"))}`, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: "round",
      borderColor: "#9AF2AE",
      dimBorder: true,
    });
  }

  const width = terminalWidth();
  const minWidths = [...diffMinimums];

  const colWidths = distributeWidths(diffWeights, minWidths, width);

  const table = buildTable({
    head: [
      palette.heading(`${figures.hamburger} ${t("parameterHeading")}`),
      palette.heading(`${figures.arrowRight} ${t("changeHeading")}`),
      palette.heading(`${figures.info} ${t("reasonHeading")}`),
    ],
    colWidths,
    theme: "rounded",
  });

  diffs.forEach((diff) => {
    table.push([
      formatParameter(diff, i18n),
      formatChange(diff.from, diff.to),
      palette.text(diff.reason || palette.muted("—")),
    ]);
  });

  // Create header for changes
  const changeCount = diffs.length;
  const changeLabel =
    changeCount === 1
      ? t("suggestedChangeSingular")
      : t("suggestedChangePlural");
  const header = boxen(
    `${figures.star} ${palette.bold(`${changeCount} ${changeLabel}`)}`,
    {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: "#F2C94C",
    },
  );

  return `${header}\n${table.toString()}`;
}

/**
 * Format global rationale (LLM's overall strategy explanation)
 */
export function formatRationale(rationale, i18n = defaultI18n) {
  if (!rationale || typeof rationale !== "string" || !rationale.trim()) {
    return "";
  }

  return boxen(`${figures.pointer} ${palette.text(rationale.trim())}`, {
    title: `${figures.star} ${i18n.t("strategyTitle")}`,
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "#7AD7F0",
    dimBorder: true,
  });
}

/**
 * Format warnings as a styled list
 */
export function formatWarnings(warnings, i18n = defaultI18n) {
  if (!warnings || warnings.length === 0) return "";

  const warningList = warnings
    .map((w) => `  ${palette.warning(figures.warning)} ${palette.text(w)}`)
    .join("\n");

  return boxen(warningList, {
    title: `${figures.warning} ${i18n.t("warningsTitle")}`,
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 0, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "#FFB347",
    dimBorder: true,
  });
}

/**
 * Format JSON with syntax highlighting for console output
 */
export function formatJsonForConsole(data) {
  const json = JSON.stringify(data, null, 2);

  // Token-based syntax highlighting
  const tokenRegex =
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

  return json.replace(tokenRegex, (match) => {
    // Keys (strings followed by colon)
    if (/^".*":$/.test(match)) {
      return palette.jsonKey(match);
    }
    // String values
    if (/^"/.test(match)) {
      return palette.jsonString(match);
    }
    // Booleans
    if (/^(true|false)$/.test(match)) {
      return palette.jsonBoolean(match);
    }
    // Null
    if (/^null$/.test(match)) {
      return palette.jsonNull(match);
    }
    // Numbers
    return palette.jsonNumber(match);
  });
}

/**
 * Format success message when file is written
 */
export function formatSuccess(message) {
  return boxen(`${figures.tick} ${palette.success(message)}`, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "#9AF2AE",
    dimBorder: true,
  });
}

/**
 * Format error message
 */
export function formatError(message) {
  return boxen(`${figures.cross} ${palette.error(message)}`, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "#FF6B6B",
  });
}

/**
 * Format info message
 */
export function formatInfo(message) {
  return `${palette.info(figures.info)} ${palette.text(message)}`;
}

/**
 * Create a section divider
 */
export function divider(label = "") {
  const width = Math.min(terminalWidth() - 4, 60);
  if (label) {
    const labelLen = label.length + 2;
    const sideLen = Math.floor((width - labelLen) / 2);
    const line = "─".repeat(sideLen);
    return palette.muted(`${line} ${label} ${line}`);
  }
  return palette.muted("─".repeat(width));
}

// Export palette and figures for external use
export { palette, figures };
