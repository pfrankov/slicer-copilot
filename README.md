# Slicer Copilot

![Demo](https://github.com/user-attachments/assets/5878ea30-bd7d-45ea-9a83-1ee18a6e9b23)

**AI-powered optimization for your Bambu Studio 3D printing projects.**

Slicer Copilot analyzes your `.3mf` project files, understands your goals (like "Maximum Strength" or "Visual Quality"), and uses an LLM to tune your print settings automatically.

## Features

- **Smart Analysis**: Reads printer, filament, and process settings from your `.3mf` file.
- **Goal-Oriented**: Optimize for Strength, Speed, Visual Quality, or a Custom goal.
- **Safe**: Never modifies your 3D geometry. Only tunes process settings.
- **Transparent**: Explains _why_ every change is made.
- **Multi-Language**: Supports English, Russian, Spanish, French, German, and Chinese.
- **CI/CD Ready**: Runs interactively or in fully automated pipelines.

## Getting Started

### Prerequisites

- **Node.js 20** or higher.
- An **OpenAI-compatible API key** (OpenAI, Anthropic via adapter, LocalLLM, etc.).

### Installation

You can run the tool directly using `npx` or install it globally.

```bash
# Run directly
npx slicer-copilot-new optimize my-project.3mf --api-key=sk-

# Or install globally
npm install -g slicer-copilot-new
```

### Configuration

Create a `.env` file in your project directory to store your API keys.

```bash
cp .env.example .env
```

**Required variables:**

```ini
OPENAI_API_KEY=sk-...
```

**Optional variables:**

```ini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-6.1-sol  # Default: gpt-6.1-sol
OPENAI_REASONING_EFFORT=medium  # low | medium | high | none (reasoning-capable models)
```

## Usage

### Interactive Mode (Default)

Simply run the command on your file. The tool will ask you for your optimization goal.

```bash
npx slicer-copilot-new optimize input.3mf
```

### Dry Run (Safe Mode)

Want to see what _would_ change without writing a new file? Use `--dry-run`.

```bash
npx slicer-copilot-new optimize input.3mf --dry-run
```

### Automated / Non-Interactive

For scripts or batch processing, use `--non-interactive` and provide an intent file.

```bash
npx slicer-copilot-new optimize input.3mf \
  --non-interactive \
  --intent-file intent.json
```

### Localization

Switch the interface and AI reasoning language using `--language`.

```bash
npx slicer-copilot-new optimize input.3mf --language ru
```

**Supported languages:**

- `en` (English)
- `ru` (Russian)
- `es` (Spanish)
- `fr` (French)
- `de` (German)
- `zh` (Chinese)

## Optimization Goals

When running interactively, you can choose from the following goals:

| Goal                    | Description                                                      |
| :---------------------- | :--------------------------------------------------------------- |
| **Balanced**            | A good mix of speed, quality, and strength.                      |
| **Functional Strength** | Prioritizes part durability and layer adhesion.                  |
| **Visual Quality**      | Focuses on surface finish and fine details.                      |
| **Draft / Speed**       | Maximizes print speed for prototypes.                            |
| **Custom**              | Follows your specific instructions (e.g., "Make it watertight"). |

## Example Output

Here is what the tool looks like in action:

```text
npx slicer-copilot-new optimize new-years-ball.3mf --output test-ny.3mf
✔ Project loaded successfully

╭ ★ Slicer Copilot ────╮
│  Project Summary     │
│  new-years-ball.3mf  │
╰──────────────────────╯
╭──────────────────────────────────┬───────────────────────────────────────────────────────────────────────────╮
│ ℹ Field                          │ → Details                                                                 │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ ◼ File                           │ new-years-ball.3mf                                                        │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ ▶ Printer                        │ Bambu Lab H2S ● 0.4mm nozzle ● Bed: Textured PEI Plate                    │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ ◉ Filament                       │ Bambu PLA Basic @BBL H2S [PLA]                                            │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ ❯ Profile                        │ 0.20mm Standard @BBL H2S                                                  │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ ☰ Process                        │ Layer 0.12 mm │ Walls 2 │ Infill 5% │ gyroid                              │
╰──────────────────────────────────┴───────────────────────────────────────────────────────────────────────────╯
★ Select optimization goal (↑/↓ + Enter)

  Balanced
› Functional Strength — Maximum durability and load capacity
  Visual Quality
  Draft / Speed
  Custom


📝 Add notes about the model (geometry, material quirks, desired result)
   Press Enter to skip
›
✓ Selected: Functional Strength
✔ AI analysis complete

╭─────────────────────────────╮
│ ★ 24 Suggested Changes      │
╰─────────────────────────────╯
╭─────────────────────────────────┬─────────────────────────────┬────────────────────────────────────────────╮
│ ☰ Parameter                     │ → Change                    │ ℹ Reason                                   │
├─────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────┤
│ wall_line_count                 │ 2 → 3                       │ Increase perimeters to 3 to reinforce the  │
│                                 │                             │ shell and mounting loops without changing  │
│                                 │                             │ geometry.                                  │
├─────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────┤
│ infill_density_percent          │ 5 → 15                      │ Increase infill from 5% to 15% for better  │
│                                 │                             │ overall part strength and impact           │
│                                 │                             │ resistance.                                │
├─────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────┤
│ nozzle_temp_c                   │ 220 → 225                   │ Slightly increase PLA nozzle temp to 225°C │
│                                 │                             │ to improve layer adhesion while staying    │
│                                 │                             │ within recommended range.                  │
├─────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────┤
│ fan_speed_percent               │ 100 → 80                    │ Reduce cooling to 80% to improve layer     │
│                                 │                             │ bonding, while maintaining enough cooling  │
│                                 │                             │ for the surface details.                   │
├─────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────┤
│ speeds.wall_inner               │ 150 → 100                   │ Slow down inner walls to 100 mm/s to       │
│                                 │                             │ reduce vibration and improve bonding.      │
╰─────────────────────────────────┴─────────────────────────────┴────────────────────────────────────────────╯

╭ ★ Strategy ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ❯ Settings biased towards strength: more perimeters and infill, higher temperature, reduced cooling, and reduced │
│ speeds on critical sections for better layer adhesion.                                                           │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────╮
│ ✔ Optimized project written to test-ny.3mf       │
╰──────────────────────────────────────────────────╯
```

## Advanced Options

| Flag                     | Description                                                            |
| :----------------------- | :--------------------------------------------------------------------- |
| `--output <file>`        | Specify the output filename (default: `*.optimized.3mf`).              |
| `--force`                | Allow the AI to overwrite settings you manually changed in the slicer. |
| `--verbose`              | Show the full prompt and JSON payload sent to the AI.                  |
| `--mock-response <file>` | Use a saved JSON response instead of calling the API (for testing).    |

## How It Works

1. **Parses**: Extracts printer info, filament data, and current settings from the `.3mf` archive.
2. **Analyzes**: Sends a summary and plate previews to the LLM.
3. **Optimizes**: The AI suggests specific setting changes based on your goal.
4. **Applies**: Updates the configuration files inside the archive.
5. **Saves**: Writes a new `.3mf` file. **Geometry is never touched.**

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint
```

---

_Note: This tool is experimental. Always preview the sliced file in Bambu Studio before printing._
