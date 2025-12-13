#!/usr/bin/env node
/**
 * Script to fetch real LLM responses for different scenarios
 * to use as test fixtures.
 *
 * Usage: node scripts/fetch-fixtures.js
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildLlmRequestPayload } from "../src/llm/requestBuilder.js";
import { requestOptimization } from "../src/llm/optimizerClient.js";
import { loadConfig } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "../test/fixtures/real-responses");

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// Sample normalized project data
const sampleNormalized = {
  fileName: "test-model.3mf",
  projectSummary: {
    printer: {
      name: "Bambu Lab X1 Carbon",
      nozzle_diameter_mm: 0.4,
    },
    filaments: [
      {
        id: "0",
        name: "Bambu PETG Basic",
        material_family: "PETG",
        color: "#808080",
        nozzle_temp_recommended_range_c: [230, 260],
        bed_temp_recommended_range_c: [70, 85],
      },
    ],
    base_profile: "0.20mm Standard @BBL X1C",
    plates: [],
  },
  currentSettings: {
    globalProcess: {
      layer_height_mm: 0.2,
      first_layer_height_mm: 0.2,
      wall_line_count: 2,
      top_layers: 4,
      bottom_layers: 4,
      infill_density_percent: 15,
      infill_pattern: "grid",
      nozzle_temp_c: 245,
      bed_temp_c: 70,
      fan_speed_percent: 70,
      first_layers_fan_percent: 0,
      speeds: {
        wall_outer: 120,
        wall_inner: 150,
        infill: 200,
        first_layer: 50,
      },
      supports_enabled: false,
      adhesion_type: "skirt",
      retraction_length: 0.8,
      retraction_speed: 30,
      z_hop: 0.4,
    },
    perObjectOverrides: {},
  },
};

// Different test scenarios
const scenarios = [
  {
    name: "functional-strength",
    description: "Optimize for functional strength with PETG bracket",
    intent: {
      primary_goal: "functional_strong",
      secondary_goals: [],
      load_bearing: true,
      safety_critical: false,
      constraints: {
        max_print_time_hours: null,
        material_saving_important: false,
      },
      locked_parameters: [],
      preferred_focus: ["walls", "infill"],
      free_text_description:
        "This is a mounting bracket that will hold a small shelf. Needs to be strong.",
    },
  },
  {
    name: "visual-quality",
    description: "Optimize for visual quality - decorative item",
    intent: {
      primary_goal: "visual_quality",
      secondary_goals: [],
      load_bearing: false,
      safety_critical: false,
      constraints: {
        max_print_time_hours: null,
        material_saving_important: false,
      },
      locked_parameters: [],
      preferred_focus: ["top_surface", "walls"],
      free_text_description:
        "Decorative vase that will be visible. Surface quality is most important.",
    },
  },
  {
    name: "draft-fast",
    description: "Optimize for speed - prototype",
    intent: {
      primary_goal: "draft_fast",
      secondary_goals: [],
      load_bearing: false,
      safety_critical: false,
      constraints: {
        max_print_time_hours: 2,
        material_saving_important: true,
      },
      locked_parameters: [],
      preferred_focus: ["speed"],
      free_text_description:
        "Quick prototype to check fit. Quality not important, just need it fast.",
    },
  },
  {
    name: "safety-critical",
    description: "Safety critical part - tool holder",
    intent: {
      primary_goal: "functional_strong",
      secondary_goals: [],
      load_bearing: true,
      safety_critical: true,
      constraints: {
        max_print_time_hours: null,
        material_saving_important: false,
      },
      locked_parameters: [],
      preferred_focus: ["walls", "infill", "layers"],
      free_text_description:
        "Tool holder that will be mounted above workspace. Must not fail.",
    },
  },
];

async function fetchScenario(scenario) {
  console.log(`\n📡 Fetching: ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  const payload = buildLlmRequestPayload({
    normalized: sampleNormalized,
    userIntent: scenario.intent,
    plateImages: [],
  });

  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error("No API key found. Set OPENAI_API_KEY in .env file.");
  }

  const logger = {
    debug: (msg) => console.log(`   [debug] ${msg}`),
  };

  try {
    const response = await requestOptimization({ payload, config, logger });
    return response;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("🚀 Fetching real LLM responses for test fixtures...\n");
  console.log(`   API Base: ${process.env.OPENAI_BASE_URL || "default"}`);
  console.log(`   Model: ${process.env.OPENAI_MODEL || "gpt-4.1-mini"}`);

  const results = {};

  for (const scenario of scenarios) {
    const response = await fetchScenario(scenario);
    if (response) {
      results[scenario.name] = {
        scenario: {
          name: scenario.name,
          description: scenario.description,
          intent: scenario.intent,
        },
        response,
      };

      // Save individual fixture file
      const filePath = path.join(FIXTURES_DIR, `${scenario.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
      console.log(`   ✅ Saved to ${filePath}`);
    }

    // Small delay between requests to be nice to the API
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Save combined file
  const combinedPath = path.join(FIXTURES_DIR, "all-scenarios.json");
  fs.writeFileSync(combinedPath, JSON.stringify(results, null, 2));
  console.log(`\n📦 Combined results saved to ${combinedPath}`);

  console.log("\n✨ Done!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
