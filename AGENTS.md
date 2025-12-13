# Agent Brief

Purpose: Slicer Copilot loads a Bambu Studio `.3mf`, summarizes printer/filament/settings, gathers user intent, calls an OpenAI-compatible optimizer, applies the suggested setting changes, and writes an updated `.3mf` without touching geometry or unknown archive contents.

## Workflow

- Use Node.js 20+ with ESM modules.
- TDD with Vitest; run `npm test` (coverage 100% with configured exclusions in `vitest.config.js`), `npm run lint`, `npm run format`.
- Husky + `lint-staged` enforce Prettier on commit; `.gitignore` covers node/OS/temp artifacts.
- Keep functions small (≤3 params; prefer options objects). Cyclomatic complexity capped via sonarjs ESLint rule.
- Update both README.md and AGENTS.md when protocols or behaviors change.
- Environment: `.env` supported via `dotenv`; sample in `.env.example`. Never commit real keys; `.gitignore` already ignores `.env*`.

## Key Modules

- `src/cli.js` — Commander CLI: handles options, loads `.3mf`, intent, LLM call, diff printing, writing output. Supports `--dry-run`, `--non-interactive`, `--intent-file`, `--verbose`, `--mock-response`, `--force` (allows changing user-modified keys; `--override-user-settings` still supported), `--language` (localizes CLI output and requests localized LLM replies), env-based auto-confirm for tests. `--verbose` prints the system prompt and JSON payload. Console output uses `cli-table3` + `chalk` + `boxen` + `ora` with responsive columns, spinners, and colored diffs/JSON.
- `src/3mf/parser.js` / `writer.js` — ZIP handling via JSZip. Parser normalizes printer/filament/settings and only includes plates/geometry when present in metadata (no fallback layout because the exports lack usable data). It also surfaces plate preview PNGs (`Metadata/plate_*.png`) for LLM vision input. Writer replaces metadata JSON while preserving other entries, and updates `different_settings_to_system` so Bambu Studio treats changed settings as profile overrides.
- `src/apply/changes.js` — Applies LLM change set onto the normalized model (global + per-object overrides).
- `src/llm/prompt.js` — System prompt for LLM with clear rules about geometry, output format, and an **explicit list of available parameters with descriptions** to prevent hallucinated parameter names.
- `src/llm/requestBuilder.js` — Builds JSON payload combining project data, current settings, and sparse `intentDetails` (no empty/default noise; only meaningful user fields are included). Includes optional plate images.
- `src/llm/optimizerClient.js` — OpenAI-compatible chat call with JSON response_format, retry on invalid JSON; mock path/env for tests.
- `src/intent/intent.js` — Collects intent (interactive single-question arrow selector or JSON), normalizes goals/constraints, and prompts for optional free-text notes about the model. Primary goals now include `custom` (no presets; rely on user-provided notes/constraints).
- `src/utils/summary.js` — Human-readable summary/diff formatting using `cli-table3` + `chalk` + `boxen` + `figures` (responsive tables, syntax-highlighted JSON, styled boxes for warnings/rationale).

## JSON Protocol

- Request: version, projectSummary (fileName, printer, filaments, base_profile, optional plates/objects with geometry when provided), currentSettings (global process + per-object overrides), `intentDetails` (sparse; omits false/empty defaults), optional plateImages (data URLs).
- New flags: `allowUserSettingOverrides` (bool; when false, userModifiedSettings are treated as locked) and `targetLanguage` (ISO-ish code for LLM textual output) ride alongside the request. CLI exposes this via `--force` (or legacy `--override-user-settings`).
- System prompt instructs LLM: only use documented parameters, no geometry changes, use base profile as baseline, choose change magnitude itself, honor explicit constraints, consider bed type for adhesion/cooling, and use images for support/cooling hints.
- Response: `changes[]` (scope global/object, parameter, newValue, reason), `globalRationale` (required: brief strategy explanation), optional `warnings[]`. Strict JSON required; retry once on invalid JSON.

## Geometry/Settings Model

- PrinterInfo: name, nozzle_diameter_mm, bed_type (from `curr_bed_type`), optional bed size (enclosure/open vs closed is not captured).
- FilamentInfo: id/name/material_family/color + optional temp ranges.
- GlobalProcessSettings: Extensive parameter set including:
  - **Layer**: layer_height_mm, first_layer_height_mm
  - **Walls**: wall_line_count, line_width, outer/inner_wall_line_width, wall_sequence
  - **Top/Bottom**: top_layers, bottom_layers, top/bottom_surface_pattern, ironing_type/speed/flow
  - **Infill**: infill_density_percent, infill_pattern, sparse_infill_line_width
  - **Speeds**: wall_outer/inner, infill, first_layer, top_surface, bridge, travel, support speeds
  - **Acceleration**: travel/outer_wall/inner_wall/sparse_infill/initial_layer acceleration
  - **Temperature**: nozzle_temp_c, bed_temp_c
  - **Cooling**: fan_speed_percent, first_layers_fan_percent, overhang_fan_speed, slow_down_layer_time
  - **Supports**: supports_enabled, support_threshold_angle, support_style, support_top_z_distance
  - **Adhesion**: adhesion_type, brim_width, skirt_distance/loops
  - **Retraction**: retraction_length/speed, z_hop
  - **Flow**: filament_flow_ratio, print_flow_ratio, initial_layer_flow_ratio, bridge_flow
  - **Seam**: seam_position
  - **Advanced**: pressure_advance
- Per-object overrides keyed as `${plateIndex}::${objectName}` (plate index omitted when unknown) to avoid name collisions; overrides carry plateIndex/objectName. Geometry heuristics include bounding box, max/min dimensions, slender flags when available from metadata.

## Constraints

- No geometry edits.

## Testing & Coverage

- Vitest with 100% thresholds; CLI, parser, writer, HTTP client, and config excluded per `vitest.config.js` for focused coverage.
- Fixtures: `test/fixtures/sample3mf.js` builds a mock `.3mf`; `test/fixtures/mockResponse.json` simulates LLM output.
- Mock LLM via `--mock-response` or env `LLM_MOCK_RESPONSE`. Auto-confirm/env knobs help avoid interactive prompts in tests.

## Notes

- Default model `gpt-4.1-mini`; configurable via env/flags.
- User-modified settings (`userModifiedSettings`) are skipped by default during apply; pass `--force` to allow changing them (flag is also forwarded to the optimizer; legacy `--override-user-settings` remains).
- Printer enclosure state and plate/object layout are omitted in summaries/payloads when metadata lacks them (current Bambu exports do not provide reliable data).
- Always preserve unknown ZIP entries; only metadata/settings are rewritten.
- When requirements change (JSON schema, intent fields, parsing rules, safety ranges, coverage scope), update this brief and README.md together.
