# @vraj0703/ai-memory

> Persistent memory organ for AI agents — vector store, strategies, cognitive state, knowledge manifests. Mockable defaults so it runs without SQLite, Ollama, or NextCloud.

[![CI](https://github.com/vraj0703/ai-memory/actions/workflows/ci.yml/badge.svg)](https://github.com/vraj0703/ai-memory/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node-18+-green.svg)](package.json)

The "memory" of an AI agent — the layer that holds what's been said, what worked, what didn't, and what the agent thinks about itself across sessions. Six interfaces (vector store, embedder, strategy store, cognitive state, knowledge manifests, optional remote backup), six default mocks, one DI container that picks per-integration.

> **Status:** v0.1.0. Lifted from raj-sadan. Mock-default DI runs `clone + npm install + npm start` in seconds with no backing service. Set `MEMORY_USE_REAL=all` to switch to live SQLite + Ollama + NextCloud.

## What's in it

| Surface | Purpose |
|---|---|
| **Vector store** | Persist content + embeddings, similarity search by cosine |
| **Embedder** | Turn text into vectors (real: Ollama nomic-embed-text v1.5; mock: deterministic hash-derived) |
| **Strategy store** | Reinforcement-learning weights for decision frameworks (decay + reinforce + weaken) |
| **Cognitive store** | PROTOCOL-12 reflection / attention / calibration — the agent's snapshot of itself |
| **Knowledge store** | TOML capability manifests (tools, APIs, services the agent can invoke) |
| **Remote state store** | Optional off-device backup (raj-sadan uses NextCloud on a Pi) |

Six interfaces in `src/domain/repositories/i_*.js`. Each has a real implementation in `src/data/` and a stub in `src/data/repositories/mocks/`.

## Install

```bash
npm install @vraj0703/ai-memory
```

Zero dependencies for the default (mock) path. Real path needs three optional peer deps:
- `better-sqlite3` — for the real `SQLiteVectorStore` and `SQLiteStrategyStore`
- `@modelcontextprotocol/sdk` + `zod` — for `ai-memory mcp`

The package loads without them installed; you only hit the requires when you opt in.

## Use

### Standalone HTTP service

```bash
ai-memory serve                  # starts on port 3488 with mocks
ai-memory --version
ai-memory --help

# CLI shortcuts
ai-memory remember "the meeting starts at 3pm tomorrow"
ai-memory recall mock-1234567890-abcdef
ai-memory state                  # cognitive snapshot
```

### MCP server (Claude Code / Cursor / Codex)

```bash
ai-memory mcp                    # speaks MCP over stdio
```

Four tools auto-discovered:
- `memory_remember` — store content + vector
- `memory_recall` — fetch by id
- `memory_search` — vector similarity search
- `memory_state` — cognitive state snapshot

### From code

```js
const { createContainer } = require("@vraj0703/ai-memory/container");

const c = createContainer();    // all mocks
const v = await c.embedder.embed("hello");
const id = await c.vectorStore.store({ content: "hello", vector: v });

// Real Ollama embeddings + real SQLite store; the rest stay mocked
const real = createContainer({ useReal: "embedder,store" });
```

### Switch to real integrations

```bash
MEMORY_USE_REAL=all ai-memory serve
MEMORY_USE_REAL=embedder,store ai-memory serve
```

Six known keys: `store`, `embedder`, `strategies`, `cognitive`, `knowledge`, `remote`.

## Mockability contract

Every external integration ships with a stub. The contract:

- `clone + npm install + npm start` runs in 5 seconds with no env vars set.
- Stubs return `[mock]`-tagged synthetic payloads.
- The stub embedder is deterministic — same input always produces the same vector — so similarity search returns sensible results without Ollama.
- Switching to real is one env var (`MEMORY_USE_REAL`) — no code changes.

12/12 smoke tests run in <250 ms. None touch disk or the network.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `MEMORY_PORT` | 3488 | HTTP port |
| `MEMORY_USE_REAL` | (empty) | Comma-separated integrations to switch to real, or `all` |
| `MEMORY_DB_PATH` | `data/data_sources/local/memory.db` | SQLite file when store/strategies are real |
| `MEMORY_EMBEDDING_MODEL` | `nomic-embed-text:v1.5` | Ollama model when embedder is real |
| `MEMORY_EMBEDDING_DIMENSIONS` | 768 | Vector size |
| `MEMORY_OLLAMA_EMBED_URL` | `http://localhost:11434/api/embed` | Ollama endpoint |
| `MEMORY_NEXTCLOUD_HOST` | `http://100.108.180.118:3481` | Remote backup target |
| `MEMORY_SIMILARITY_THRESHOLD` | 0.7 | Minimum cosine for "similar enough" |
| `MEMORY_DEFAULT_TOP_K` | 5 | Default search result count |
| `MEMORY_STRATEGY_DECAY_HALF_LIFE` | 30 | Days for unused strategy weights to halve |
| `MEMORY_STRATEGY_REINFORCE` | 0.1 | Weight bump per successful use |
| `MEMORY_STRATEGY_WEAKEN` | 0.05 | Weight reduction per failure |

## What's not here yet

- **Vector index for high-throughput search** — v0.1.0 does naive cosine over all stored items in the in-memory mock and over a SQLite scan in the real path. v0.2 will add `sqlite-vss` (or LanceDB) for proper ANN. Tracked.
- **Comprehensive integration tests** — only mocks are tested. Real Ollama embeddings + real SQLite + real NextCloud are exercised by raj-sadan's boot smoke tests via `MEMORY_USE_REAL=all`; standalone consumers do their own.

## See also

- [ai-mind](https://github.com/vraj0703/ai-mind) — the cognitive layer ai-memory persists state for
- [ai-senses](https://github.com/vraj0703/ai-senses) — the perception layer
- [ai-constitution](https://github.com/vraj0703/ai-constitution) — the governance framework
- [ai-lib](https://github.com/vraj0703/ai-lib) — shared logger / retry / utilities

## License

MIT.
