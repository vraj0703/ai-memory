/**
 * smoke.test.js — basic load + DI swap tests for ai-memory.
 *
 * The contract: clone + install + start runs with no SQLite, no Ollama, no
 * NextCloud, no env vars set. The container wires up mocks by default;
 * MEMORY_USE_REAL swaps individual integrations to real.
 */

const test = require("node:test");
const assert = require("node:assert");

const { createContainer, KNOWN_KEYS } = require("../src/di/container.js");
const { InMemoryVectorStore } = require("../src/data/repositories/mocks/in_memory_vector_store.js");
const { StubEmbeddingProvider } = require("../src/data/repositories/mocks/stub_embedding_provider.js");
const { InMemoryStrategyStore } = require("../src/data/repositories/mocks/in_memory_strategy_store.js");
const { InMemoryCognitiveStore } = require("../src/data/repositories/mocks/in_memory_cognitive_store.js");
const { InMemoryKnowledgeStore } = require("../src/data/repositories/mocks/in_memory_knowledge_store.js");
const { StubRemoteStateStore } = require("../src/data/repositories/mocks/stub_remote_state_store.js");

// ────────────────────────────────────────────────────────────
// Default container — every integration is mocked
// ────────────────────────────────────────────────────────────

test("default container wires up mocks for every integration", () => {
  const c = createContainer();
  assert.ok(c.vectorStore instanceof InMemoryVectorStore);
  assert.ok(c.embedder instanceof StubEmbeddingProvider);
  assert.ok(c.strategyStore instanceof InMemoryStrategyStore);
  assert.ok(c.cognitiveStore instanceof InMemoryCognitiveStore);
  assert.ok(c.knowledgeStore instanceof InMemoryKnowledgeStore);
  assert.ok(c.remoteStateStore instanceof StubRemoteStateStore);
});

// ────────────────────────────────────────────────────────────
// Stub behavior
// ────────────────────────────────────────────────────────────

test("stub embedder returns deterministic vectors", async () => {
  const e = new StubEmbeddingProvider();
  const v1 = await e.embed("hello world");
  const v2 = await e.embed("hello world");
  assert.deepStrictEqual(v1, v2, "same input must produce the same vector");
  const v3 = await e.embed("different text");
  assert.notDeepStrictEqual(v1, v3);
  assert.strictEqual(v1.length, 768);
});

test("in-memory vector store stores + retrieves", async () => {
  const store = new InMemoryVectorStore();
  const id = await store.store({ content: "test note", vector: [0.1, 0.2, 0.3] });
  const item = await store.get(id);
  assert.strictEqual(item.content, "test note");
  assert.strictEqual(item.metadata.mock, true);
});

test("in-memory vector store similarity search ranks by cosine", async () => {
  const store = new InMemoryVectorStore();
  await store.store({ content: "a", vector: [1, 0, 0] });
  await store.store({ content: "b", vector: [0.9, 0.1, 0] });
  await store.store({ content: "c", vector: [0, 1, 0] });
  const results = await store.search([1, 0, 0], { topK: 3 });
  assert.strictEqual(results[0].content, "a");
  assert.strictEqual(results[1].content, "b");
  assert.strictEqual(results[2].content, "c");
});

test("in-memory cognitive store round-trips reflection / attention / calibration", async () => {
  const store = new InMemoryCognitiveStore();
  await store.writeReflection({ summary: "test reflection" });
  await store.writeAttention({ focus: "test focus" });
  await store.writeCalibration({ confidence: 0.7 });

  const r = await store.readReflection();
  assert.strictEqual(r.summary, "test reflection");
  const a = await store.readAttention();
  assert.strictEqual(a.focus, "test focus");
  const cal = await store.readCalibration();
  assert.strictEqual(cal.confidence, 0.7);

  const snap = await store.snapshot();
  assert.ok(snap.reflection);
  assert.ok(snap.attention);
  assert.ok(snap.calibration);
});

test("in-memory strategy store reinforces + weakens weights", async () => {
  const store = new InMemoryStrategyStore();
  await store.upsert({ id: "s1", name: "Test strategy", weight: 0.5 });
  await store.reinforce("s1", 0.2);
  const r = await store.get("s1");
  assert.ok(Math.abs(r.weight - 0.7) < 1e-9);
  await store.weaken("s1", 0.3);
  const w = await store.get("s1");
  assert.ok(Math.abs(w.weight - 0.4) < 1e-9);
});

test("in-memory knowledge store ships with a seed capability", async () => {
  const store = new InMemoryKnowledgeStore();
  const all = await store.list();
  assert.ok(all.length >= 1);
  assert.ok(all[0].mock);
});

test("stub remote state store records backups without network", async () => {
  const store = new StubRemoteStateStore();
  const r = await store.backup({ domain: "test", path: "x.toml", contents: "data" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.mock, true);
  const list = await store.list({ domain: "test" });
  assert.strictEqual(list.length, 1);
});

// ────────────────────────────────────────────────────────────
// MEMORY_USE_REAL swap behavior
// ────────────────────────────────────────────────────────────

test("MEMORY_USE_REAL=embedder swaps only the embedder", () => {
  const c = createContainer({ useReal: "embedder" });
  assert.ok(!(c.embedder instanceof StubEmbeddingProvider));
  // Others stay mocked
  assert.ok(c.vectorStore instanceof InMemoryVectorStore);
  assert.ok(c.cognitiveStore instanceof InMemoryCognitiveStore);
});

test("MEMORY_USE_REAL=all swaps every integration to real", () => {
  const c = createContainer({ useReal: "all" });
  assert.ok(!(c.vectorStore instanceof InMemoryVectorStore));
  assert.ok(!(c.embedder instanceof StubEmbeddingProvider));
  assert.ok(!(c.strategyStore instanceof InMemoryStrategyStore));
  assert.ok(!(c.cognitiveStore instanceof InMemoryCognitiveStore));
  assert.ok(!(c.knowledgeStore instanceof InMemoryKnowledgeStore));
  assert.ok(!(c.remoteStateStore instanceof StubRemoteStateStore));
});

test("KNOWN_KEYS export documents the swap surface", () => {
  assert.ok(KNOWN_KEYS.includes("store"));
  assert.ok(KNOWN_KEYS.includes("embedder"));
  assert.ok(KNOWN_KEYS.includes("strategies"));
  assert.ok(KNOWN_KEYS.includes("cognitive"));
  assert.ok(KNOWN_KEYS.includes("knowledge"));
  assert.ok(KNOWN_KEYS.includes("remote"));
  assert.strictEqual(KNOWN_KEYS.length, 6);
});

// ────────────────────────────────────────────────────────────
// End-to-end: store + search + recall using only mocks
// ────────────────────────────────────────────────────────────

test("e2e: remember + search + recall returns the same item", async () => {
  const c = createContainer();
  const note = "the quick brown fox";
  const vector = await c.embedder.embed(note);
  const id = await c.vectorStore.store({ content: note, vector });

  const queryVector = await c.embedder.embed(note);
  const results = await c.vectorStore.search(queryVector, { topK: 1 });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, id);
  assert.strictEqual(results[0].content, note);
  assert.ok(results[0].similarity > 0.99, "self-similarity should be ~1");

  const recalled = await c.vectorStore.get(id);
  assert.strictEqual(recalled.content, note);
});
