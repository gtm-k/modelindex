# ModelIndex

[![Deploy](https://github.com/gtm-k/modelindex/actions/workflows/deploy.yml/badge.svg)](https://github.com/gtm-k/modelindex/actions/workflows/deploy.yml)
[![Data Sync](https://github.com/gtm-k/modelindex/actions/workflows/sync-data.yml/badge.svg)](https://github.com/gtm-k/modelindex/actions/workflows/sync-data.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/demo-live%20on%20GitHub%20Pages-blue?logo=github)](https://gtm-k.github.io/modelindex/)
[![Status](https://img.shields.io/badge/status-v0.1%20alpha-orange.svg)](https://github.com/gtm-k/modelindex/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/gtm-k/modelindex/issues)
[![Made with Vanilla JS](https://img.shields.io/badge/built%20with-vanilla%20JS-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Offline Ready](https://img.shields.io/badge/offline-ready-4caf50?logo=pwa)](https://web.dev/progressive-web-apps/)

**ModelIndex** is an open-source, privacy-first web app for evaluating, ranking, and comparing AI models across multiple domains using a configurable weighted scoring engine.

Nothing leaves the browser. No server, no telemetry, no accounts, no API keys. Benchmark data is fetched by GitHub Actions and served as static JSON from the same origin.

> **v0.1 Alpha** — Core features complete across 4 domains. 35 models, 50+ sub-metrics, 14 presets. [Try the live demo &rarr;](https://gtm-k.github.io/modelindex/)

---

## Highlights

- **Multi-domain** — LLMs, Robotics, Weather Forecasting, and Materials Science models in one platform
- **35 models** — GPT-4o, Claude 3.7, Gemini 2.5, Llama 3.3, DeepSeek R1, OpenVLA, GraphCast, MACE-MP-0, and more
- **Custom scoring** — Build your own weighted MCS (Model Capability Score) index for your specific use case
- **Sensitivity analysis** — See how stable your rankings are before committing to a model choice
- **Privacy-first** — Zero external requests from the browser. All data is same-origin static JSON
- **Offline-ready** — Works fully offline after first visit via Service Worker + IndexedDB

---

## What it does

ModelIndex normalises scores across 50+ sub-metrics grouped into factor categories, and lets you build a custom **Model Capability Score (MCS)** index weighted by your use case.

| Feature | Details |
|---|---|
| **Model Registry** | 35 pre-seeded models across 4 domains with domain-specific factor schemas |
| **MCS Engine** | Weighted composite scoring with fixed baseline normalisation per domain |
| **Index Builder** | 6-step wizard: constraints, presets, weights, model selection, sensitivity, save |
| **Live Preview** | Real-time MCS ranking as you adjust sliders — instant client-side computation |
| **Sensitivity Analysis** | Impact ranking + tornado chart showing rank stability under weight perturbation |
| **Hardware & Pricing** | VRAM requirements for open-weight models, API pricing for proprietary models |
| **Score Provenance** | Every score traced to benchmark, connector, fetch date, and contamination flag |
| **Comparison Reports** | Side-by-side comparison of 2–5 models with provenance footnotes |
| **License Checker** | Filter models by license compatibility (MIT, Apache, GPL, Proprietary) |
| **Dark / Light mode** | Full theme system with system preference detection |
| **Zero install** | Visit the URL and it works. No downloads, no build tools |

---

## Supported Domains

| Domain | Models | Factor Groups | Presets |
|---|---|---|---|
| **LLMs** | 20 | Reasoning, Factuality, Safety, Coding, Agentic, Instruction Following, Efficiency, Bias, Context, Multimodal | General, Code Agent, Research, Medical/Legal, Customer Support |
| **Robotics** | 5 | Task Success, Manipulation, Generalization, Planning, Efficiency | Manipulation, General Robotics |
| **Weather** | 5 | Forecast Accuracy, Probabilistic Skill, Resolution, Efficiency | Operational, Research |
| **Materials** | 5 | Property Prediction, Stability Discovery, Generalization, Structure Quality | Discovery, Simulation |

---

## How it works

```
GitHub Actions (cron: daily at 06:00 UTC)
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

## Data Sources

| Connector | Tier | Source |
|---|---|---|
| HuggingFace Open LLM Leaderboard | T1 | HuggingFace Datasets API |
| HELM Lite (Stanford CRFM) | T1 | crfm.stanford.edu |
| LMArena ELO | T1 | lmarena.ai |
| EvalPlus (HumanEval+ / MBPP+) | T1 | GitHub Releases API |
| RouterBench | T1 | HuggingFace Datasets |
| RULER Long Context | T1 | HuggingFace Datasets |
| WinoBias / BBQ | T1 | HuggingFace Datasets |

---

## Quick Start

```bash
# Clone
git clone https://github.com/gtm-k/modelindex.git
cd modelindex

# Generate seed benchmark data
node scripts/generate-seed-scores.js

# Serve locally
npx http-server public -p 8080 -c-1

# Open http://localhost:8080
```

No `npm install` required for the app itself. Pure HTML/CSS/JS with CDN dependencies (Chart.js, Lucide icons, Google Fonts).

---

## Project Structure

```
modelindex/
├── public/                      # Static site root (deployed to GitHub Pages)
│   ├── index.html               # Single-file app (HTML + CSS + JS)
│   ├── sw.js                    # Service Worker for offline support
│   ├── manifest.json            # PWA manifest
│   ├── js/                      # Modular JS engines
│   │   ├── db.js                # IndexedDB wrapper
│   │   ├── factors.js           # Factor schemas (LLM + domain-specific)
│   │   ├── domain-schemas.js    # Robotics, Weather, Materials factor definitions
│   │   ├── mcs.js               # Pure MCS calculator
│   │   ├── presets.js           # 14 use-case weight presets across 4 domains
│   │   └── sensitivity.js       # Sensitivity analysis engine
│   └── data/                    # Static data (committed by GitHub Actions)
│       ├── baseline.json        # LLM normalization min/max
│       ├── baseline-robotics.json
│       ├── baseline-weather.json
│       ├── baseline-materials.json
│       ├── registry.json        # 35 model entries across 4 domains
│       ├── hardware.json        # Hardware specs + API pricing for all models
│       ├── license-compat.json  # License compatibility matrix
│       ├── tokenizer-ratios.json
│       └── scores/              # Benchmark data (auto-updated by CI)
├── scripts/
│   ├── fetch-data.js            # Data pipeline (runs in GitHub Actions)
│   └── generate-seed-scores.js  # Seed data generator for development
├── .github/workflows/
│   ├── deploy.yml               # Auto-deploy to gh-pages on push to master
│   └── sync-data.yml            # Fetch benchmark data daily
├── package.json
└── LICENSE
```

---

## Contributing

Contributions welcome. Areas that would benefit most:

- **Baseline calibration** — research-backed min/max values for sub-metrics
- **Model coverage** — expanding `registry.json` with new models and accurate metadata
- **Additional connectors** — any public benchmark leaderboard with a stable JSON API
- **Test suite** — unit tests for `mcs.js`, `sensitivity.js`, and data pipeline adapters
- **Domain expansion** — adding new domains (biology, chemistry, audio, etc.)

Please [open an issue](https://github.com/gtm-k/modelindex/issues) before submitting a large PR to align on approach.

---

## Roadmap

| Version | Focus |
|---|---|
| **v0.1 Alpha** *(current)* | Core MCS engine, 4 domains, 35 models, Index Builder, Sensitivity Analysis, GitHub Pages |
| **v0.2** | Real benchmark data pipeline, decision cards, index sharing, comparison export |
| **v0.3** | Community connector plugins, additional domains, improved data provenance |
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
[Open X-Embodiment](https://robotics-transformer-x.github.io/) ·
[GraphCast](https://github.com/google-deepmind/graphcast) ·
[Materials Project](https://materialsproject.org/)
