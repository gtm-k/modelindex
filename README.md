# ModelIndex

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://gtm-k.github.io/modelindex/)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](https://github.com/gtm-k/modelindex/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/gtm-k/modelindex/issues)

**ModelIndex** is an open-source static web app for evaluating, ranking, and comparing AI language models using a configurable weighted scoring system.

Nothing leaves the browser. No server, no telemetry, no accounts, no API keys. Benchmark data is fetched by GitHub Actions and served as static JSON from the same origin.

> **Alpha release.** Core features are complete and functional. Data syncs from 7 public benchmark sources every 6 hours via GitHub Actions.

---

## What it does

ModelIndex pulls benchmark data from 7 public T1 data sources, normalises scores across 50 sub-metrics grouped into 10 factor categories, and lets you build a custom **Model Capability Score (MCS)** index weighted by your specific use-case.

| Capability | Details |
|---|---|
| **Model Registry** | 20+ pre-seeded models (GPT-4o, Claude 3.7, Gemini 2.5, Llama 3.3, DeepSeek R1, and more) |
| **MCS Engine** | Weighted composite scoring across 10 factors, 50 sub-metrics with fixed baseline normalisation |
| **Index Builder** | 6-step wizard: set constraints, pick a preset, adjust weights, select models, run sensitivity, save |
| **Live Preview** | Real-time MCS ranking as you adjust sliders — instant client-side computation |
| **Sensitivity Analysis** | Tornado chart showing how rank-stable your weights are (±10 point perturbation) |
| **Score Provenance** | Every score traced to benchmark, connector, fetch date, staleness level, and contamination flag |
| **Comparison Reports** | Markdown reports comparing 2–5 models with provenance footnotes and staleness warnings |
| **Offline-first** | All data cached in IndexedDB. Works fully offline after first visit via Service Worker |
| **Auto-sync** | GitHub Actions fetches benchmark data every 6h — always fresh on next page load |
| **License Checker** | Filter models by compatibility with your project's license (MIT, Apache, GPL, Proprietary) |
| **Manual Cost Entry** | Enter token pricing manually to populate efficiency scores |
| **Dark / Light mode** | Full theme system with system preference detection and manual toggle |
| **Zero install** | Visit the URL and it works. No downloads, no native modules, no build tools |

---

## How it works

```
GitHub Actions (cron: every 6h)
  → Runs T1 adapters (HuggingFace, HELM, LMArena, EvalPlus, RULER, BBQ)
  → Commits results to data/scores/ as static JSON
  → GitHub Pages auto-deploys

Browser loads index.html
  → Fetches data/*.json from same origin (no CORS, no external requests)
  → IndexedDB caches locally (works offline after first load)
  → MCS engine runs entirely client-side (pure functions)
```

---

## Privacy

- Zero API keys required
- Zero external network requests from the browser
- All data is same-origin static JSON
- No localStorage secrets, no cookies, no telemetry
- IndexedDB stores data locally in your browser only

---

## Factor Groups & Sub-metrics

ModelIndex evaluates models across **10 factor groups** containing **50 sub-metrics**:

| Factor | Key Benchmarks |
|---|---|
| Reasoning | ARC-C, HellaSwag, WinoGrande, PIQA, OpenBookQA |
| Factuality | TruthfulQA, NaturalQuestions, MMLU-Pro, SciQ, FActScore |
| Safety | MT-Bench safety, HarmBench ASR, Refusal rate, RLHF reward proxy, ToxiGen |
| Coding | HumanEval+, MBPP+, DS-1000, SWE-Bench Verified, CodeXGLUE |
| Agentic | GAIA, AgentBench, ToolBench, WebArena, SWE-Agent |
| Instruction Following | MT-Bench, IFEval, AlpacaEval 2.0, FLASK, InstructEval |
| Efficiency | Tokens/sec, TTFT latency, cost/1M tokens, RouterBench, MMLU efficiency |
| Bias & Fairness | WinoBias, BBQ, StereoSet, CrowS-Pairs, ToxiGen bias |
| Long Context | RULER, NIAH 128K, LongBench, ZeroSCROLLS, InfiniteBench |
| Multimodal | MMMU, MMBench, ChartQA, TextVQA, LLaVA-bench |

---

## Data Sources

| Connector | Tier | Schedule | Source |
|---|---|---|---|
| HuggingFace Open LLM Leaderboard | T1 | Every 6h | HuggingFace Datasets API |
| HELM Lite (Stanford CRFM) | T1 | Every 24h | crfm.stanford.edu |
| LMArena ELO | T1 | Every 6h | lmarena.ai |
| EvalPlus (HumanEval+ / MBPP+) | T1 | On-demand | GitHub Releases API |
| RouterBench | T1 | Weekly | HuggingFace Datasets |
| RULER Long Context | T1 | Weekly | HuggingFace Datasets |
| WinoBias / BBQ | T1 | Weekly | HuggingFace Datasets |

---

## Development

```bash
# Clone
git clone https://github.com/gtm-k/modelindex.git
cd modelindex

# Fetch benchmark data locally (optional — runs in CI automatically)
node scripts/fetch-data.js

# Serve locally
npx http-server public -p 8080 -c-1

# Open http://localhost:8080
```

No `npm install` required for the app itself. The site is pure HTML/CSS/JS with CDN dependencies (Chart.js, Lucide icons, Google Fonts).

---

## Project Structure

```
modelindex/
├── public/                      # Static site root (deployed to GitHub Pages)
│   ├── index.html               # Single-file app (HTML + CSS + JS, IIFE pattern)
│   ├── sw.js                    # Service Worker for offline support
│   ├── manifest.json            # PWA manifest
│   ├── js/                      # Modular JS engines
│   │   ├── db.js                # IndexedDB wrapper (async, replaces SQLite)
│   │   ├── factors.js           # FACTOR_SCHEMA (10 groups × 5 sub-metrics)
│   │   ├── mcs.js               # Pure MCS calculator
│   │   ├── presets.js           # 5 use-case weight presets
│   │   └── sensitivity.js       # Tornado sensitivity analysis
│   └── data/                    # Static data (committed by GitHub Actions)
│       ├── baseline.json        # Normalization min/max for 50 sub-metrics
│       ├── registry.json        # 20+ pre-seeded model entries
│       ├── hardware.json        # GPU/RAM requirements for open-weight models
│       ├── license-compat.json  # License compatibility matrix
│       ├── tokenizer-ratios.json# Chars-per-token for cost normalization
│       └── scores/              # Benchmark data (auto-updated by CI)
│           ├── manifest.json    # Connector sync metadata
│           ├── huggingface.json
│           ├── helm.json
│           ├── lmarena.json
│           ├── evalplus.json
│           ├── ruler.json
│           └── bbq.json
├── scripts/
│   └── fetch-data.js            # Data pipeline (runs in GitHub Actions)
├── .github/workflows/
│   ├── deploy.yml               # Auto-deploy public/ to gh-pages on push
│   └── sync-data.yml            # Fetch benchmark data every 6h
├── docs/                        # Design docs and plans
├── package.json
└── LICENSE
```

---

## Contributing

Contributions welcome. The areas that would benefit most:

- **`baseline.json` calibration** — the min/max values for all 50 sub-metrics need research-backed validation
- **Model seed data** — expanding `registry.json` with accurate provider/license/tag metadata for new models
- **Additional T1 connectors** — any public benchmark leaderboard with a stable JSON API
- **Test suite** — unit tests for `mcs.js`, `sensitivity.js`, and fetch-data.js adapters

Please [open an issue](https://github.com/gtm-k/modelindex/issues) before submitting a large PR to align on approach.

---

## Roadmap

| Version | Focus |
|---|---|
| **v0.1 Alpha** *(current)* | Core MCS engine, 7 T1 connectors, Index Builder wizard, Model Registry, Settings, GitHub Pages hosting |
| **v0.2** | Decision Cards, Index sharing, sub-metric weight editor, comparison report export |
| **v0.3** | Community connector plugin system, improved sensitivity visualization |
| **v1.0** | Stable data format, full test suite, comprehensive model coverage |

---

## License

[Apache License 2.0](LICENSE)

Model benchmark data is sourced from public datasets and third-party leaderboards. Respective dataset licenses apply to the underlying data. ModelIndex does not redistribute benchmark data — it fetches and caches it locally.

---

## Acknowledgements

Built on the shoulders of:

[HuggingFace Open LLM Leaderboard](https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard) ·
[HELM (Stanford CRFM)](https://crfm.stanford.edu/helm/) ·
[LMArena](https://lmarena.ai) ·
[EvalPlus](https://evalplus.github.io/) ·
[RouterBench](https://huggingface.co/datasets/routerbench/routerbench) ·
[RULER](https://arxiv.org/abs/2404.06654) ·
[BBQ](https://arxiv.org/abs/2110.08193) ·
[WinoBias](https://arxiv.org/abs/1804.06876)
