# Real Data Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all synthetic/PRNG-generated LLM scores with real benchmark data from LiveBench and real pricing from OpenRouter, eliminating fake data from the public site.

**Architecture:** Two new connectors are added to `scripts/fetch-data.js`: `fetchLiveBench()` aggregates per-question scores from the HuggingFace Datasets API into per-model factor scores, and `fetchOpenRouterPricing()` pulls live pricing into `public/data/pricing.json`. The app loads pricing at init and merges with user overrides. The seed score generator and its output file are deleted.

**Tech Stack:** Node.js fetch (built-in), HuggingFace Datasets REST API, OpenRouter REST API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-28-real-data-sources-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/fetch-data.js` | Modify | Add LiveBench + OpenRouter connectors, delete seed-llm from managed set |
| `public/data/pricing.json` | Create (generated) | Real pricing data from OpenRouter |
| `public/data/scores/livebench.json` | Create (generated) | Real benchmark scores from LiveBench |
| `public/index.html` | Modify (~15 lines) | Load pricing.json at init, merge with user pricing |
| `public/sw.js` | Modify (1 line) | Cache bump |
| `scripts/generate-seed-scores.js` | Delete | No longer needed |
| `public/data/scores/seed-llm.json` | Delete | Replaced by livebench.json |

---

### Task 1: Add LiveBench Connector to fetch-data.js

**Files:**
- Modify: `scripts/fetch-data.js`

- [ ] **Step 1: Add LiveBench model alias mapping and task mapping constants**

Insert after the existing `SUB_METRIC_MAP` object (after line ~70, before the `// Helpers` section):

```javascript
// ---------------------------------------------------------------------------
// LiveBench: model name → registry model_id aliases
// ---------------------------------------------------------------------------

const LIVEBENCH_MODEL_ALIASES = {
  'gpt-4o-2024-11-20':           'gpt-4o',
  'gpt-4o-2024-08-06':           'gpt-4o',
  'gpt-4o-mini-2024-07-18':      'gpt-4o-mini',
  'o3-2025-04-16':               'o3',
  'o3-mini-2025-01-31-high':     'o3',
  'claude-3-7-sonnet-20250219':  'claude-3-7-sonnet',
  'claude-3-7-sonnet-20250219-base': 'claude-3-7-sonnet',
  'claude-3-5-haiku-20241022':   'claude-3-5-haiku',
  'gemini-2.5-pro-exp-03-25':    'gemini-2-5-pro',
  'gemini-2.0-pro-exp-02-05':    'gemini-2-0-pro',
  'gemini-2.0-flash':            'gemini-2-0-flash',
  'gemini-2.0-flash-001':        'gemini-2-0-flash',
  'meta-llama-3.1-405b-instruct-turbo': 'llama-3-1-405b',
  'llama-3.3-70b-instruct-turbo':       'llama-3-3-70b',
  'deepseek-r1':                 'deepseek-r1',
  'deepseek-v3':                 'deepseek-v3',
  'mistral-large-2411':          'mistral-large-2',
  'mistral-large':               'mistral-large-2',
  'open-mixtral-8x22b':          'mixtral-8x22b',
  'phi-4':                       'phi-4',
  'gemma-3-27b-it':              'gemma-3-27b',
  'command-r-plus-08-2024':      'command-r-plus',
  'command-r-plus':              'command-r-plus',
};

// LiveBench task → factor_group + sub_metric mapping
const LIVEBENCH_TASK_MAP = {
  'math':                   { factor: 'reasoning',  metric: 'math_accuracy' },
  'reasoning':              { factor: 'reasoning',  metric: 'logical_deduction' },
  'coding':                 { factor: 'coding',     metric: 'humaneval_pass1' },
  'language':               { factor: 'instruction', metric: 'ifeval_score' },
  'data_analysis':          { factor: 'factuality', metric: 'factual_consistency' },
  'instruction_following':  { factor: 'instruction', metric: 'format_compliance' },
  'typos':                  { factor: 'instruction', metric: 'constraint_following' },
};
```

- [ ] **Step 2: Add the `fetchLiveBench()` function**

Insert before the `// Main` section (before the `CONNECTORS` array):

```javascript
async function fetchLiveBench() {
  // LiveBench stores per-question judgments in a HuggingFace dataset.
  // We paginate through rows, filter to registry models, and aggregate.
  const PAGE = 100;
  const BASE_URL = 'https://datasets-server.huggingface.co/rows?dataset=livebench/model_judgment&config=default&split=leaderboard';

  // Collect raw scores: { registryModelId: { task: [score, score, ...] } }
  const modelTaskScores = {};
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${BASE_URL}&offset=${offset}&length=${PAGE}`;
    let data;
    try {
      data = await fetchJSON(url);
    } catch (e) {
      // Some pages may fail; stop pagination
      console.log(`  -- LiveBench pagination stopped at offset ${offset}: ${e.message}`);
      break;
    }
    total = data.num_rows_total || 0;
    const rows = data.rows || [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const row = r.row || r;
      const apiModel = row.model || '';
      const registryId = LIVEBENCH_MODEL_ALIASES[apiModel];
      if (!registryId) continue; // skip models not in our registry

      const task = row.task || '';
      const score = row.score;
      if (score == null || typeof score !== 'number') continue;

      if (!modelTaskScores[registryId]) modelTaskScores[registryId] = {};
      if (!modelTaskScores[registryId][task]) modelTaskScores[registryId][task] = [];
      modelTaskScores[registryId][task].push(score);
    }
    offset += PAGE;
  }

  // Aggregate: average per model per task, scale 0-1 → 0-100
  const scores = [];
  for (const [modelId, tasks] of Object.entries(modelTaskScores)) {
    for (const [task, vals] of Object.entries(tasks)) {
      const mapping = LIVEBENCH_TASK_MAP[task];
      if (!mapping) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const scaled = avg * 100; // LiveBench scores are 0-1

      scores.push(scoreRow(
        'livebench', modelId, mapping.factor, mapping.metric, scaled,
        'LiveBench',
        'https://livebench.ai/'
      ));
    }
  }

  return envelope('livebench', scores);
}
```

- [ ] **Step 3: Add `livebench` to the CONNECTORS array**

Change the `CONNECTORS` array to include livebench:

```javascript
const CONNECTORS = [
  { id: 'huggingface', fn: fetchHuggingFace },
  { id: 'helm', fn: fetchHELM },
  { id: 'lmarena', fn: fetchLMArena },
  { id: 'evalplus', fn: fetchEvalPlus },
  { id: 'ruler', fn: fetchRULER },
  { id: 'bbq', fn: fetchBBQ },
  { id: 'livebench', fn: fetchLiveBench },
];
```

- [ ] **Step 4: Run fetch-data.js and verify LiveBench output**

```bash
cd C:/Users/gowth/Documents/ModelIndex && node scripts/fetch-data.js
```

Verify:
- Console shows `Fetching livebench...` with a score count > 0
- `public/data/scores/livebench.json` exists
- Check model IDs match registry: `node -e "const d=require('./public/data/scores/livebench.json'); const ids=[...new Set(d.scores.map(s=>s.model_id))].sort(); console.log(ids.length, 'models:', ids);"`
- Scores should be 0-100 range, not 0-1

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-data.js public/data/scores/livebench.json public/data/scores/manifest.json
git commit -m "feat: add LiveBench connector for real benchmark scores"
```

---

### Task 2: Add OpenRouter Pricing Connector

**Files:**
- Modify: `scripts/fetch-data.js`
- Create: `public/data/pricing.json` (generated)

- [ ] **Step 1: Add OpenRouter model alias mapping**

Insert after the `LIVEBENCH_TASK_MAP` constant:

```javascript
// ---------------------------------------------------------------------------
// OpenRouter: model ID → registry model_id aliases
// ---------------------------------------------------------------------------

const OPENROUTER_MODEL_ALIASES = {
  'openai/gpt-4o':                      'gpt-4o',
  'openai/gpt-4o-mini':                 'gpt-4o-mini',
  'openai/o3':                           'o3',
  'openai/o4-mini':                      'o4-mini',
  'anthropic/claude-3.7-sonnet':         'claude-3-7-sonnet',
  'anthropic/claude-3.5-haiku':          'claude-3-5-haiku',
  'google/gemini-2.5-pro':               'gemini-2-5-pro',
  'google/gemini-2.0-flash-001':         'gemini-2-0-flash',
  'meta-llama/llama-3.1-405b-instruct':  'llama-3-1-405b',
  'meta-llama/llama-3.3-70b-instruct':   'llama-3-3-70b',
  'qwen/qwen3-235b-a22b':               'qwen3-235b-a22b',
  'qwen/qwen3-32b':                      'qwen3-32b',
  'deepseek/deepseek-r1':                'deepseek-r1',
  'deepseek/deepseek-chat':              'deepseek-v3',
  'mistralai/mistral-large':             'mistral-large-2',
  'mistralai/mixtral-8x22b-instruct':    'mixtral-8x22b',
  'microsoft/phi-4':                      'phi-4',
  'google/gemma-3-27b-it':               'gemma-3-27b',
  'cohere/command-r-plus-08-2024':        'command-r-plus',
};
```

- [ ] **Step 2: Add `fetchOpenRouterPricing()` function**

Insert after `fetchLiveBench()`:

```javascript
async function fetchOpenRouterPricing() {
  // OpenRouter provides pricing for 300+ models. We extract pricing
  // for our registry models and write to a separate pricing.json file.
  const PRICING_PATH = path.resolve(__dirname, '..', 'public', 'data', 'pricing.json');

  const data = await fetchJSON('https://openrouter.ai/api/v1/models');
  const models = data.data || data || [];
  const pricing = {};

  for (const m of models) {
    const registryId = OPENROUTER_MODEL_ALIASES[m.id];
    if (!registryId) continue;
    if (pricing[registryId]) continue; // first match wins

    const promptCost = parseFloat(m.pricing?.prompt || '0');
    const completionCost = parseFloat(m.pricing?.completion || '0');

    // OpenRouter pricing is per-token; convert to per-1M-tokens
    pricing[registryId] = {
      input_cost_per_1m:  Math.round(promptCost * 1_000_000 * 100) / 100,
      output_cost_per_1m: Math.round(completionCost * 1_000_000 * 100) / 100,
      context_length:     m.context_length || null,
      source:             'openrouter',
      fetched_at:         new Date().toISOString(),
    };
  }

  fs.writeFileSync(PRICING_PATH, JSON.stringify(pricing, null, 2) + '\n', 'utf-8');
  console.log(`  -> wrote ${PRICING_PATH} (${Object.keys(pricing).length} models)`);
  return Object.keys(pricing).length;
}
```

- [ ] **Step 3: Call `fetchOpenRouterPricing()` in `main()`**

In the `main()` function, add this block AFTER the connector loop and BEFORE the manifest auto-discovery section:

```javascript
  // Fetch pricing (separate from score connectors)
  console.log('Fetching openrouter pricing...');
  try {
    const pricingCount = await fetchOpenRouterPricing();
    console.log(`  -> ${pricingCount} models with pricing`);
  } catch (err) {
    console.error(`  !! openrouter pricing failed: ${err.message}`);
  }
```

- [ ] **Step 4: Run and verify pricing output**

```bash
cd C:/Users/gowth/Documents/ModelIndex && node scripts/fetch-data.js
```

Verify:
- Console shows `Fetching openrouter pricing...` with a count
- `public/data/pricing.json` exists
- Check contents: `node -e "const p=require('./public/data/pricing.json'); console.log(Object.keys(p).length, 'models'); console.log(JSON.stringify(p['gpt-4o'], null, 2));"`
- Should show realistic pricing (e.g., GPT-4o: $2.50 input, $10.00 output)

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-data.js public/data/pricing.json
git commit -m "feat: add OpenRouter pricing connector"
```

---

### Task 3: Load Pricing in the App

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Load pricing.json at init**

Find the `Promise.all` in the init function that loads `baseline.json`, `license-compat.json`, `hardware.json`, `registry.json` (around line 1195). Add `pricing.json` to the fetch list.

Change:
```javascript
    const [baselineRaw, licenseCompat, hardwareManifest, registryData] = await Promise.all([
      fetch('data/baseline.json').then(r => r.json()),
      fetch('data/license-compat.json').then(r => r.json()),
      fetch('data/hardware.json').then(r => r.json()),
      fetch('data/registry.json').then(r => r.json()),
    ]);
```

to:

```javascript
    const [baselineRaw, licenseCompat, hardwareManifest, registryData, apiPricing] = await Promise.all([
      fetch('data/baseline.json').then(r => r.json()),
      fetch('data/license-compat.json').then(r => r.json()),
      fetch('data/hardware.json').then(r => r.json()),
      fetch('data/registry.json').then(r => r.json()),
      fetch('data/pricing.json').then(r => r.json()).catch(() => ({})),
    ]);
```

- [ ] **Step 2: Store API pricing in App.state**

After the line `App.state.hardwareManifest = hardwareManifest.models || hardwareManifest;`, add:

```javascript
    App.state.apiPricing = apiPricing || {};
```

- [ ] **Step 3: Merge API pricing with user pricing in the registry view**

In the registry view's `refresh()` function, find the block that builds `_pricing` from `allPricing` (the user-entered pricing from IndexedDB). Change:

```javascript
        _pricing = {};
        for (const p of (allPricing || [])) {
          _pricing[p.model_id] = p;
        }
```

to:

```javascript
        // Start with API pricing, let user overrides take precedence
        _pricing = {};
        for (const [modelId, p] of Object.entries(App.state.apiPricing || {})) {
          _pricing[modelId] = { model_id: modelId, ...p };
        }
        for (const p of (allPricing || [])) {
          _pricing[p.model_id] = p; // user override wins
        }
```

- [ ] **Step 4: Test locally**

Load the site at `http://localhost:8765`. The Cost/1M tok column should now show real pricing (e.g., "$2.5/$10" for GPT-4o) instead of "$—" for all models.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: load OpenRouter pricing at init, merge with user overrides"
```

---

### Task 4: Delete Seed Score Generator and File

**Files:**
- Delete: `scripts/generate-seed-scores.js`
- Delete: `public/data/scores/seed-llm.json`

- [ ] **Step 1: Delete the seed score generator script**

```bash
rm scripts/generate-seed-scores.js
```

- [ ] **Step 2: Delete the seed-llm.json file**

```bash
rm public/data/scores/seed-llm.json
```

- [ ] **Step 3: Remove seed-llm entry from manifest if present**

Run fetch-data.js to regenerate the manifest without seed-llm:

```bash
cd C:/Users/gowth/Documents/ModelIndex && node scripts/fetch-data.js
```

Verify the manifest no longer contains `seed-llm`:
```bash
node -e "const m=require('./public/data/scores/manifest.json'); console.log(Object.keys(m));"
```

Expected: `['huggingface', 'helm', 'lmarena', 'evalplus', 'ruler', 'bbq', 'livebench', 'robotics', 'weather', 'materials']` — no `seed-llm`.

- [ ] **Step 4: Commit**

```bash
git add -A scripts/generate-seed-scores.js public/data/scores/seed-llm.json public/data/scores/manifest.json
git commit -m "chore: remove seed score generator and synthetic data"
```

---

### Task 5: Bump Service Worker Cache, Push, and Verify

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Bump service worker cache version**

Change:
```javascript
const CACHE_NAME = 'modelindex-v5';
```
to:
```javascript
const CACHE_NAME = 'modelindex-v6';
```

- [ ] **Step 2: Run full fetch-data.js and verify all outputs**

```bash
cd C:/Users/gowth/Documents/ModelIndex && node scripts/fetch-data.js
```

Check all outputs:
```bash
# LiveBench scores exist with registry model IDs
node -e "const d=require('./public/data/scores/livebench.json'); const ids=[...new Set(d.scores.map(s=>s.model_id))].sort(); console.log('LiveBench:', ids.length, 'models'); ids.forEach(id=>console.log(' ', id));"

# Pricing exists
node -e "const p=require('./public/data/pricing.json'); console.log('Pricing:', Object.keys(p).length, 'models'); Object.entries(p).forEach(([k,v])=>console.log(' ', k, '$'+v.input_cost_per_1m+'/'+v.output_cost_per_1m));"

# No seed-llm in manifest
node -e "const m=require('./public/data/scores/manifest.json'); console.log('Manifest:', Object.keys(m));"

# Domain scores still present
node -e "const r=require('./public/data/scores/robotics.json'); console.log('Robotics:', r.scores.length, 'scores');"
```

- [ ] **Step 3: Test locally at desktop and mobile widths**

Load `http://localhost:8765`:
1. Desktop: LLM models show real scores (from LiveBench), Cost column shows real pricing
2. Mobile (375px): Cards show real MCS scores and pricing
3. Robotics/Weather/Materials: Still show scores (from domain seed files)
4. Qwen3 235B, Qwen3 32B, o4-mini: Show dashes for scores (no LiveBench data), but DO show pricing

- [ ] **Step 4: Commit and push**

```bash
git add public/sw.js public/data/scores/ public/data/pricing.json
git commit -m "feat: replace synthetic seed data with real LiveBench + OpenRouter data"
git push origin master
```
