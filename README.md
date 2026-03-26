# ModelIndex

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/gtm-k/modelindex/releases)
[![Electron](https://img.shields.io/badge/Electron-v33%2B-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](https://github.com/gtm-k/modelindex/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/gtm-k/modelindex/issues)

**ModelIndex** is an open-source, cross-platform desktop application for evaluating, ranking, and comparing AI language models using a configurable weighted scoring system — entirely offline-first, no cloud dependency required.

> **Alpha release.** Core features are complete and functional. Data connectors sync from public benchmarks automatically. API/schema may change before v1.0.

---

## What it does

ModelIndex pulls benchmark data from 7 public T1 data sources, normalises scores across 50 sub-metrics grouped into 10 factor categories, and lets you build a custom **Model Capability Score (MCS)** index weighted by your specific use-case. Think of it as a portfolio manager for AI models — instead of picking stocks by P/E ratio, you pick models by their weighted benchmark profile.

| Capability | Details |
|---|---|
| **Model Registry** | 20+ pre-seeded models (GPT-4o, Claude 3.7, Gemini 2.0, Llama 3.3, DeepSeek R1, and more) |
| **MCS Engine** | Weighted composite scoring across 10 factors, 50 sub-metrics with fixed baseline normalisation |
| **Index Builder** | 6-step wizard to build a named, versioned index for your use-case |
| **Live Preview** | Real-time MCS ranking as you adjust sliders — zero IPC latency via inline pure function |
| **Sensitivity Analysis** | Tornado chart showing how rank-stable your weights are (±10 point perturbation) |
| **Score Provenance** | Every score traced to benchmark, connector, fetch date, staleness level, and contamination flag |
| **Comparison Reports** | Markdown reports comparing 2–5 models with provenance footnotes and staleness warnings |
| **Offline-first** | All data cached in local SQLite — full functionality without internet |
| **Auto-sync** | Cron-scheduled sync from 7 T1 benchmark sources with catch-up on launch |
| **License Checker** | Filter models by compatibility with your project's license (MIT, Apache, GPL, Proprietary) |
| **Manual Cost Entry** | Enter token pricing manually to populate efficiency scores before T2 connector ships |
| **Dark / Light mode** | Full theme system with system preference detection and manual toggle |

---

## Screenshots

> Screenshots will be added after first packaged release.

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
| Artificial Analysis | T2 | Disabled | Partnership pending |
| HarmBench | T3 | Manual import | harmbench.org |

---

## Installation

### Option 1 — Download a release (recommended)

1. Go to [Releases](https://github.com/gtm-k/modelindex/releases)
2. Download the installer for your platform:
   - **Windows:** `ModelIndex-Setup-x.x.x.exe` (Squirrel NSIS installer)
   - **macOS:** `ModelIndex-x.x.x.dmg`
   - **Linux:** `modelindex_x.x.x_amd64.deb` or `.rpm`
3. Run the installer — ModelIndex will auto-update going forward via GitHub Releases

### Option 2 — Build from source

**Prerequisites**

| Requirement | Version | Notes |
|---|---|---|
| Node.js | v18+ | LTS recommended |
| npm | v9+ | Comes with Node.js |
| Python | 3.10+ | Required to compile native modules |
| Visual Studio Build Tools | 2019+ | **Windows only** — "Desktop development with C++" workload |
| Xcode Command Line Tools | latest | **macOS only** |

```bash
# 1. Clone the repository
git clone https://github.com/gtm-k/modelindex.git
cd modelindex

# 2. Install dependencies
#    This compiles better-sqlite3 and keytar against Electron's Node ABI.
#    Expect 2–5 minutes on first run.
npm install

# 3. Start in development mode
npm start

# 4. Build a distributable for your current platform
npm run make
# Output: out/make/  (installer for current OS)

# 5. Publish to GitHub Releases (maintainers only, requires GITHUB_TOKEN)
npm run publish
```

> **Windows:** Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **"Desktop development with C++"** before `npm install`. Without this, `better-sqlite3` and `keytar` will fail to compile.

> **macOS:** Run `xcode-select --install` before `npm install`.

> **Linux:** You may need `sudo apt install libsecret-1-dev` (Debian/Ubuntu) for `keytar`.

---

## Project Structure

```
modelindex/
├── src/
│   ├── main.js                   # Electron main process (BrowserWindow, IPC handlers, auto-updater)
│   ├── preload.js                # contextBridge — full window.modelIndex API surface
│   ├── data/
│   │   ├── db.js                 # SQLite wrapper (better-sqlite3, schema migrations, seed data)
│   │   ├── sync-scheduler.js     # node-cron orchestrator + IPC trigger handlers
│   │   ├── hf-parquet-client.js  # Shared HuggingFace fetch + parquet-wasm utility
│   │   ├── hf-adapter.js         # HuggingFace Open LLM Leaderboard connector
│   │   ├── helm-adapter.js       # HELM Lite connector
│   │   ├── lmarena-adapter.js    # LMArena ELO connector
│   │   ├── evalplus-adapter.js   # EvalPlus GitHub Releases connector
│   │   ├── routerbench-adapter.js# RouterBench HF dataset connector
│   │   ├── ruler-adapter.js      # RULER long-context connector
│   │   ├── bias-adapter.js       # WinoBias + BBQ fairness connector
│   │   ├── artificial-analysis-adapter.js  # T2 stub (disabled)
│   │   ├── harmbench-adapter.js  # T3 manual import connector
│   │   ├── normalization-baseline.json  # Fixed min/max per sub-metric (load-bearing)
│   │   ├── registry-manifest.json       # 20+ model seed entries
│   │   ├── hardware-manifest.json       # VRAM/GPU requirements for open-weight models
│   │   ├── license-compat.json          # License compatibility matrix
│   │   └── tokenizer-ratios.json        # Chars-per-token ratios for cost normalisation
│   └── eval/
│       ├── factors.js            # FACTOR_SCHEMA — 10 groups × 5 sub-metrics with metadata
│       ├── mcs.js                # Pure MCS calculator (no DB access, duplicated in renderer)
│       ├── sensitivity.js        # Sensitivity analysis engine (pure function)
│       └── presets.js            # 5 use-case weight presets
├── renderer/
│   └── modelindex.html           # Single-file renderer (IIFE module pattern, no bundler)
├── assets/                       # App icons (not included — see below)
├── forge.config.js               # Electron Forge packaging + Fuses config
├── package.json
└── LICENSE
```

### Architecture highlights

- **IPC contract first** — `preload.js` declares the full `window.modelIndex` API before any renderer code is written. Every UI feature binds to this contract.
- **MCS as a pure function** — `mcs.js` has no DB access and is duplicated inline in the renderer for zero-latency live preview in the Index Builder (slider changes compute MCS without an IPC round-trip).
- **Single HTML renderer** — all UI in `renderer/modelindex.html` using an IIFE namespace pattern (`App.views.*`) with CSS custom-property design tokens. No bundler, no framework.
- **Offline-first SQLite** — benchmark data cached locally with WAL mode. `validate()` + graceful fallback in every connector means stale cached data is served when the network is unavailable.
- **Security hardened** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP meta tag with explicit connector domains, ASAR integrity validation, Electron Fuses (RunAsNode disabled, OnlyLoadFromAsar enabled).
- **Schema versioned** — `PRAGMA user_version` in SQLite with migration gating. Safe to update without corrupting user databases.

---

## App Icons

Place these files in `assets/` before running `npm run make`:

| File | Size | Platform |
|---|---|---|
| `icon.ico` | 256×256 | Windows installer |
| `icon.icns` | 512×512 | macOS app bundle |
| `icon.png` | 512×512 | Linux |
| `dmg-background.png` | 540×380 | macOS DMG background |

---

## Environment / API Keys

No `.env` file required. Optional API keys are stored in the OS keychain via `keytar` — never in the database or on disk in plaintext.

| Service | Key name | Purpose |
|---|---|---|
| GitHub | `modelindex / github-token` | Increases EvalPlus rate limit from 60 to 5000 req/hr |
| Artificial Analysis | `modelindex / artificial-analysis-key` | T2 efficiency connector (partnership required) |

---

## Contributing

Contributions are welcome. The areas that would benefit most:

- **Icon / branding assets** — the app currently ships without icons
- **`normalization-baseline.json` calibration** — the min/max values for all 50 sub-metrics are the most impactful data quality task; they need research-backed validation
- **Additional T1 connectors** — any public benchmark leaderboard with a stable JSON/Parquet API; implement the 7-function adapter interface in `src/data/`
- **Test suite** — unit tests for `mcs.js`, `sensitivity.js`, and each adapter's `transform()` function
- **Model seed data** — expanding `registry-manifest.json` with accurate provider/license/tag metadata for new models

Please [open an issue](https://github.com/gtm-k/modelindex/issues) before submitting a large PR to align on approach.

---

## Roadmap

| Version | Focus |
|---|---|
| **v0.1 Alpha** *(current)* | Core MCS engine, 7 T1 connectors, Index Builder wizard, Model Registry, Settings |
| **v0.2** | Decision Cards, Index sharing (`.modelindex-indexes`), sub-metric weight editor, T2 connectors |
| **v0.3** | Web/service tier for team sharing, REST API mode, CI/CD plugin |
| **v1.0** | Stable public API, full test suite, icon set, community connector plugin system |

---

## License

[Apache License 2.0](LICENSE)

Model benchmark data is sourced from public datasets and third-party leaderboards. Respective dataset licenses apply to the underlying data. ModelIndex does not redistribute benchmark data — it fetches and caches it locally at runtime.

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
[WinoBias](https://arxiv.org/abs/1804.06876) ·
[HarmBench](https://arxiv.org/abs/2402.04249)
