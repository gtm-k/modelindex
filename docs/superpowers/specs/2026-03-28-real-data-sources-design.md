# Replace Seed Data with Real Benchmark Sources

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Eliminate all synthetic/PRNG-generated scores from the LLM domain. Every displayed number comes from a real benchmark API or real pricing data. Domain models (robotics, weather, materials) keep existing seed data for now.

---

## 1. Problem

The `generate-seed-scores.js` script creates fake benchmark scores using a deterministic PRNG. These synthetic numbers are displayed on a public site alongside real API data with no visual distinction. This undermines credibility.

## 2. New Data Sources

### 2.1 LiveBench (new connector)

**Source:** HuggingFace Datasets API — `livebench/model_judgment` dataset
**Endpoint:** `https://datasets-server.huggingface.co/rows?dataset=livebench/model_judgment&config=default&split=leaderboard&offset={N}&length=100`
**Auth:** None required
**Coverage:** 17 of 20 registry LLM models
**Data format:** Per-question rows with fields: `model`, `task`, `score` (0-1), `category`

**Processing:**
1. Paginate through all rows (60k+ rows, 100 per page)
2. Filter to only models matching our registry (via alias mapping)
3. Group by model + task
4. Average scores per model per task
5. Scale from 0-1 to 0-100

**LiveBench model name → registry model_id mapping:**

```
gpt-4o-2024-11-20           → gpt-4o
gpt-4o-mini-2024-07-18      → gpt-4o-mini
o3-2025-04-16               → o3
claude-3-7-sonnet-20250219  → claude-3-7-sonnet
claude-3-5-haiku-20241022   → claude-3-5-haiku
gemini-2.5-pro-exp-03-25    → gemini-2-5-pro
gemini-2.0-pro-exp-02-05    → gemini-2-0-pro
gemini-2.0-flash-001        → gemini-2-0-flash
meta-llama-3.1-405b-instruct-turbo → llama-3-1-405b
llama-3.3-70b-instruct-turbo       → llama-3-3-70b
deepseek-r1                 → deepseek-r1
deepseek-v3                 → deepseek-v3
mistral-large-2411          → mistral-large-2
open-mixtral-8x22b          → mixtral-8x22b
phi-4                       → phi-4
gemma-3-27b-it              → gemma-3-27b
command-r-plus-08-2024      → command-r-plus
```

When multiple versions of a model exist (e.g., `gpt-4o-2024-08-06` and `gpt-4o-2024-11-20`), use the one whose name sorts last alphabetically (which corresponds to the latest date suffix). If a model appears with both base and `-thinking` variants, use the base variant.

**LiveBench task → factor schema mapping:**

| LiveBench task | factor_group | sub_metric |
|---|---|---|
| `math` | reasoning | math_accuracy |
| `reasoning` | reasoning | logical_deduction |
| `coding` | coding | humaneval_pass1 |
| `language` | instruction | ifeval_score |
| `data_analysis` | factuality | factual_consistency |
| `instruction_following` | instruction | format_compliance |
| `typos` | instruction | constraint_following |

**Output:** `scores/livebench.json` — same envelope format as other connectors.

### 2.2 OpenRouter Pricing (new connector)

**Source:** `https://openrouter.ai/api/v1/models`
**Auth:** None required
**Coverage:** 19 of 20 registry LLM models (missing gemini-2-0-pro)
**Data format:** JSON array of model objects with `pricing.prompt` and `pricing.completion` (cost per token as string)

**Processing:**
1. Fetch the full model list (single request, ~347 models)
2. Match to registry models via alias mapping
3. Convert per-token pricing to per-1M-token pricing
4. Write to a pricing-specific file

**OpenRouter ID → registry model_id mapping:**

```
openai/gpt-4o               → gpt-4o
openai/gpt-4o-mini           → gpt-4o-mini
openai/o3                    → o3
openai/o4-mini               → o4-mini
anthropic/claude-3.7-sonnet  → claude-3-7-sonnet
anthropic/claude-3.5-haiku   → claude-3-5-haiku
google/gemini-2.5-pro        → gemini-2-5-pro
google/gemini-2.0-flash-001  → gemini-2-0-flash
meta-llama/llama-3.3-70b-instruct → llama-3-3-70b
qwen/qwen3-235b-a22b        → qwen3-235b-a22b
qwen/qwen3-32b              → qwen3-32b
deepseek/deepseek-r1         → deepseek-r1
deepseek/deepseek-chat       → deepseek-v3
mistralai/mistral-large      → mistral-large-2
mistralai/mixtral-8x22b-instruct → mixtral-8x22b
microsoft/phi-4              → phi-4
google/gemma-3-27b-it        → gemma-3-27b
cohere/command-r-plus-08-2024 → command-r-plus
```

**Output:** `public/data/pricing.json` — a flat object keyed by registry model_id:

```json
{
  "gpt-4o": { "input_cost_per_1m": 2.50, "output_cost_per_1m": 10.00, "source": "openrouter" },
  ...
}
```

This replaces the current empty `_pricing` state and the manual pricing entry in Settings.

### 2.3 Existing Connectors (kept)

| Connector | Change |
|---|---|
| `huggingface` | Keep — provides data for community/open-source models. No registry matches but adds data richness for future models. |
| `helm` | Keep — with existing 0-1 → 0-100 scale fix. |
| `evalplus` | Keep — provides HumanEval/MBPP for 6 registry models. |
| `ruler` | Keep — with existing scale fix. |
| `bbq` | Keep — with existing scale fix. |
| `lmarena` | Keep — provides Elo for 2-3 registry models. |

## 3. What Gets Deleted

- `scripts/generate-seed-scores.js` — the PRNG seed score generator
- `public/data/scores/seed-llm.json` — synthetic LLM scores (replaced by livebench.json)
- All references to seed score generation in documentation and workflows

## 4. Models with No Data

Three models are too new for any public benchmark source:
- `qwen3-235b-a22b`
- `qwen3-32b`
- `o4-mini`

These models will show dashes ("—") for all factor scores and MCS. They WILL have pricing from OpenRouter. The UI already handles null/missing scores gracefully (shows "—").

As LiveBench and other sources add these models, scores will appear automatically on the next sync.

## 5. Domain Models (Out of Scope)

Robotics, Weather, and Materials domain models keep their existing seed data files (`robotics.json`, `weather.json`, `materials.json`). These are niche domains without public benchmark APIs. Replacing their seed data is a separate future effort. The manifest preservation fix from the prior commit ensures these files continue to load.

## 6. Pricing Integration

**Current state:** The Cost/1M tok column shows "$—" for all models. Users can manually enter pricing in Settings, stored in IndexedDB.

**New behavior:**
- On sync, `fetch-data.js` writes `public/data/pricing.json` with real OpenRouter pricing.
- The app loads `pricing.json` at init alongside other data files.
- User-entered pricing in Settings overrides API pricing (user preference takes priority).
- The cost cell displays: `$input/output` (e.g., `$2.50/$10.00`).

## 7. Data Freshness & Provenance

**Score provenance drawer** (the panel that opens when you click a score cell):
- Currently shows benchmark name, connector, and tier.
- After this change, LiveBench scores show: benchmark name = "LiveBench", connector = "livebench", tier = "T1".
- EvalPlus scores show: benchmark name = "EvalPlus", connector = "evalplus", tier = "T1".
- Models with no score data for a factor show: "No benchmark data available" instead of the current "Expired" tag.

**Sync frequency:** Daily cron (existing schedule) fetches all connectors including the new ones. LiveBench data updates monthly; OpenRouter pricing updates frequently.

## 8. Implementation Summary

### Changes to `scripts/fetch-data.js`:
- Add `fetchLiveBench()` connector with model alias mapping and score aggregation
- Add `fetchOpenRouterPricing()` connector that writes `pricing.json`
- Add alias mapping constants for both new connectors
- Remove `seed-llm` from the managed set (the file gets deleted)

### Changes to `public/index.html`:
- Load `pricing.json` at init alongside other data files
- Use loaded pricing as default, allow user overrides from IndexedDB
- Update cost cell rendering to show `$input/$output` format

### Files deleted:
- `scripts/generate-seed-scores.js`
- `public/data/scores/seed-llm.json`

### Files created:
- `public/data/pricing.json` (generated by fetch-data.js)

### Files modified:
- `scripts/fetch-data.js` (add 2 connectors, ~120 lines)
- `public/index.html` (pricing loading + display, ~15 lines)
- `public/sw.js` (cache bump)

## 9. Testing

- Run `node scripts/fetch-data.js` locally and verify:
  - `livebench.json` has scores for 17+ models with registry model_ids
  - `pricing.json` has pricing for 19+ models
  - All scores are 0-100 range (not 0-1)
  - Manifest includes all connector files
- Load site locally and verify:
  - LLM models show real scores (not seed data)
  - Cost column shows real pricing
  - Qwen3 and o4-mini show dashes (no fake scores)
  - Robotics/Weather/Materials still have scores
  - Score provenance shows "LiveBench" as source
