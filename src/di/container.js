/**
 * di/container.js — Dependency-injection container.
 *
 * Mock-default: every external integration ships with a stub so the organ
 * runs `clone + npm install + npm start` without SQLite, Ollama, or NextCloud.
 *
 * Set MEMORY_USE_REAL to swap individual integrations to real:
 *   MEMORY_USE_REAL="store"            — real SQLite vector + strategy stores
 *   MEMORY_USE_REAL="store,embedder"   — plus real Ollama embeddings
 *   MEMORY_USE_REAL="all"              — everything real (raj-sadan production)
 *
 * Knobs in `config`:
 *   projectRoot, port, useReal (overrides env), dbPath, embeddingModel,
 *   ollamaUrl, cognitiveDir, knowledgeDir, nextcloudHost, nextcloudDomain.
 */

const path = require("path");

// Real implementations
const { SQLiteVectorStore } = require("../data/data_sources/local/sqlite_vector_store");
const { OllamaEmbeddingProvider } = require("../data/data_sources/remote/ollama_embedding_provider");
const { SQLiteStrategyStore } = require("../data/repositories/sqlite_strategy_store");
const { FileCognitiveStore } = require("../data/repositories/file_cognitive_store");
const { TOMLKnowledgeStore } = require("../data/repositories/toml_knowledge_store");
const { NextCloudStateStore } = require("../data/data_sources/remote/nextcloud_state_store");

// Mocks
const { InMemoryVectorStore } = require("../data/repositories/mocks/in_memory_vector_store");
const { StubEmbeddingProvider } = require("../data/repositories/mocks/stub_embedding_provider");
const { InMemoryStrategyStore } = require("../data/repositories/mocks/in_memory_strategy_store");
const { InMemoryCognitiveStore } = require("../data/repositories/mocks/in_memory_cognitive_store");
const { InMemoryKnowledgeStore } = require("../data/repositories/mocks/in_memory_knowledge_store");
const { StubRemoteStateStore } = require("../data/repositories/mocks/stub_remote_state_store");

const { EMBEDDING_MODEL, NEXTCLOUD_HOST, MEMORY_PORT, DB_PATH } = require("../domain/constants");

const KNOWN_KEYS = ["store", "embedder", "strategies", "cognitive", "knowledge", "remote"];

function _parseUseReal(value) {
  if (!value) return new Set();
  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "all") return new Set(KNOWN_KEYS);
    return new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  }
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function createContainer(config = {}) {
  const projectRoot = config.projectRoot || process.cwd();
  const useReal = _parseUseReal(config.useReal ?? process.env.MEMORY_USE_REAL);
  const _real = (key) => useReal.has(key);

  const dbPath = config.dbPath || path.join(projectRoot, DB_PATH);

  // Vector store + strategy store both live in the same SQLite file in the
  // real path; in the mock path they're independent in-memory Maps.
  const vectorStore = _real("store") ? new SQLiteVectorStore({ dbPath }) : new InMemoryVectorStore();
  const strategyStore = _real("strategies")
    ? new SQLiteStrategyStore({ dbPath })
    : new InMemoryStrategyStore();

  const embedder = _real("embedder")
    ? new OllamaEmbeddingProvider({
        model: config.embeddingModel || EMBEDDING_MODEL,
        ollamaUrl: config.ollamaUrl,
      })
    : new StubEmbeddingProvider();

  const cognitiveStore = _real("cognitive")
    ? new FileCognitiveStore({
        root: config.cognitiveDir || path.join(projectRoot, "data", "data_sources", "local", "cognitive"),
      })
    : new InMemoryCognitiveStore();

  const knowledgeStore = _real("knowledge")
    ? new TOMLKnowledgeStore({
        manifestsDir: config.knowledgeDir || path.join(projectRoot, "knowledge", "manifests"),
      })
    : new InMemoryKnowledgeStore();

  const remoteStateStore = _real("remote")
    ? new NextCloudStateStore({
        host: config.nextcloudHost || NEXTCLOUD_HOST,
        domain: config.nextcloudDomain || "raj-sadan",
      })
    : new StubRemoteStateStore();

  return {
    vectorStore,
    embedder,
    strategyStore,
    cognitiveStore,
    knowledgeStore,
    remoteStateStore,
    config: {
      projectRoot,
      port: config.port || MEMORY_PORT,
      dbPath,
      useReal: Array.from(useReal),
    },
  };
}

module.exports = { createContainer, KNOWN_KEYS };
