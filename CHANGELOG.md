# Changelog

## [Unreleased]

## [0.1.1] — 2026-04-29

### Changed (BREAKING — npm scope)

- **Renamed npm package from `@vraj0703/ai-memory` to `@raj-sadan/ai-memory`** to match the project's npm org. Update install: `npm install @raj-sadan/ai-memory`.
- `release.yml` added — tag-triggered npm publish with provenance attestation.
- `publishConfig` added: `access: public`, `provenance: true`.
- `npm test` script changed from `node --test tests/ ...` to `node --test tests/*.test.js ...` (Node 22+ rejects bare directory args without `--recurse`).

### Note

v0.1.0 existed only as a Git tag (never published to npm). v0.1.1 is the first npm publish.

## [0.1.0] — 2026-04-28

First public release. Lifted from raj-sadan's v2 memory organ.

### Added

- **Clean architecture lift** — domain (entities, 6 interfaces, 6 use cases, exceptions, constants), data (sources, repositories, mocks), di, navigation, presentation. 35 JS files.
- **Mock-default DI container** — every external integration ships with a stub:
  - `InMemoryVectorStore` (Map-backed, naive cosine search)
  - `StubEmbeddingProvider` (deterministic hash-derived vectors, 768-dim)
  - `InMemoryStrategyStore` (reinforce / weaken in process)
  - `InMemoryCognitiveStore` (PROTOCOL-12 reflection / attention / calibration in memory)
  - `InMemoryKnowledgeStore` (seeded with one example capability)
  - `StubRemoteStateStore` (no-op backup, records would-be writes)
- **`MEMORY_USE_REAL` swap** — comma-separated integrations to upgrade from mock to real, or `"all"`. Six keys: `store`, `embedder`, `strategies`, `cognitive`, `knowledge`, `remote`.
- **Constants with env-var fallback** — every hard-coded raj-sadan value (Pi at `100.108.180.118`, port `3488`, embedding model `nomic-embed-text:v1.5`) honors a `MEMORY_*` env var. raj-sadan still works because defaults are unchanged.
- **CLI dispatcher** at `bin/ai-memory` — `serve`, `mcp`, `remember`, `recall`, `state`, `--version`, `--help`.
- **MCP server** at `src/presentation/mcp/server.js` exposing 4 tools: `memory_remember`, `memory_recall`, `memory_search`, `memory_state`.
- **CI matrix** on Node 18 / 20 / 22.
- **12 smoke tests** including end-to-end remember + search + recall using only mocks.

### Known limitations

- **No proper vector index** — search is naive cosine over all items. v0.2 plans `sqlite-vss` or LanceDB. Fine up to maybe 10k items; degrades after.
- **Live integration tests not in this repo** — only mocks are exercised. Real Ollama / SQLite / NextCloud paths are tested in raj-sadan's boot smoke via `MEMORY_USE_REAL=all`.
- **Cognitive PII data not lifted** — raj-sadan's `cognitive/` dir contains personal reflection / attention snapshots from real sessions; that data stayed in raj-sadan. The interface + the file format spec are public; the contents are private.
