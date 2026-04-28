const { describe, it } = require("node:test");
const assert = require("node:assert");
const { storeMemory } = require("./store_memory");
const { recallMemory } = require("./recall_memory");
const { reinforceStrategy, selectStrategy, decayStrategies, registerStrategy } = require("./manage_strategies");
const {
  saveCognitiveState, loadCognitiveState, generateBootBrief,
  appendDecision, getRecentDecisions, getDecisionsByTag,
  linkDecisionOutcome, getDecisionStats,
  registerFramework, reinforceFramework, weakenFramework,
  decayFrameworks, listFrameworks,
} = require("./manage_cognitive");
const { Strategy } = require("../entities/strategy");
const { CognitiveState } = require("../entities/cognitive_state");
const { MemoryItem } = require("../entities/memory_item");
const { DecisionFramework } = require("../entities/decision_framework");

// ─── Mock implementations ───

class MockEmbedder {
  constructor() { this.calls = []; }
  get dimensions() { return 4; }
  async embed(text) {
    this.calls.push(text);
    // Deterministic fake: hash text to a 4-dim vector
    const hash = [...text].reduce((a, c) => a + c.charCodeAt(0), 0);
    return new Float32Array([Math.sin(hash), Math.cos(hash), Math.sin(hash * 2), Math.cos(hash * 2)]);
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

class MockVectorStore {
  constructor() { this.items = new Map(); }
  async store(item) { this.items.set(item.id, item); }
  async search(queryEmb, collection, topK = 5) {
    const results = [];
    for (const item of this.items.values()) {
      if (item.collection !== collection) continue;
      if (!item.embedding) continue;
      const sim = cosineSim(queryEmb, item.embedding);
      results.push({ item, similarity: sim });
    }
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
  async delete(id) { this.items.delete(id); }
  async count(collection) {
    return [...this.items.values()].filter(i => i.collection === collection).length;
  }
}

class MockStrategyStore {
  constructor() { this.strategies = new Map(); }
  async loadAll() { return [...this.strategies.values()]; }
  async save(strategy) { this.strategies.set(strategy.id, strategy); }
  async update(id, action) {
    const s = this.strategies.get(id);
    if (!s) return;
    this.strategies.set(id, action === "reinforce" ? s.reinforce() : s.weaken());
  }
  async decayAll(halfLifeDays) {
    for (const [id, s] of this.strategies) {
      this.strategies.set(id, s.decay(halfLifeDays));
    }
  }
}

class MockCognitiveStore {
  constructor() {
    this.state = new CognitiveState();
    this.decisions = [];
    this.frameworks = new Map();
  }
  async load() { return this.state; }
  async save(state) { this.state = state; }
  async appendDecision(entry) {
    const id = entry.id || `mock-${this.decisions.length + 1}`;
    this.decisions.push({ ...entry, id });
    return id;
  }
  async recentDecisions(limit) { return this.decisions.slice(-limit).reverse(); }
  async decisionsByTag(tag) {
    return this.decisions.filter(d => Array.isArray(d.tags) && d.tags.includes(tag)).reverse();
  }
  async linkOutcome(id, outcome, quality) {
    const d = this.decisions.find(x => x.id === id);
    if (!d) return false;
    d.outcome = outcome;
    d.outcomeQuality = quality;
    d.outcomeTimestamp = new Date().toISOString();
    return true;
  }
  async decisionStats() {
    const byType = {};
    const byQuality = {};
    let totalConf = 0, confCount = 0;
    for (const d of this.decisions) {
      byType[d.type || "general"] = (byType[d.type || "general"] || 0) + 1;
      if (d.outcomeQuality) byQuality[d.outcomeQuality] = (byQuality[d.outcomeQuality] || 0) + 1;
      if (typeof d.confidence === "number") { totalConf += d.confidence; confCount++; }
    }
    return {
      total: this.decisions.length, byType, byQuality,
      avgConfidence: confCount > 0 ? totalConf / confCount : 0,
    };
  }
  async loadFrameworks() { return [...this.frameworks.values()]; }
  async saveFramework(fw) { this.frameworks.set(fw.id, fw); }
  async getFramework(id) { return this.frameworks.get(id) || null; }
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ─── Tests ───

describe("store_memory + recall_memory", () => {
  it("stores and recalls by semantic similarity", async () => {
    const embedder = new MockEmbedder();
    const store = new MockVectorStore();

    await storeMemory({ content: "whatsapp was restarted successfully", collection: "decisions", embedder, store });
    await storeMemory({ content: "cron job failed with timeout", collection: "decisions", embedder, store });
    await storeMemory({ content: "knowledge service updated", collection: "decisions", embedder, store });

    const results = await recallMemory({ query: "whatsapp restart", collection: "decisions", topK: 3, threshold: -1, embedder, store });  // -1 accepts all (mock embedder isn't semantic)
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].similarity === "number");
  });

  it("filters by collection", async () => {
    const embedder = new MockEmbedder();
    const store = new MockVectorStore();

    await storeMemory({ content: "strategy A", collection: "strategies", embedder, store });
    await storeMemory({ content: "decision B", collection: "decisions", embedder, store });

    const results = await recallMemory({ query: "test", collection: "strategies", topK: 10, threshold: -1, embedder, store });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].item.collection, "strategies");
  });

  it("respects similarity threshold", async () => {
    const embedder = new MockEmbedder();
    const store = new MockVectorStore();

    await storeMemory({ content: "test", collection: "decisions", embedder, store });

    const low = await recallMemory({ query: "test", collection: "decisions", threshold: 0, embedder, store });
    const high = await recallMemory({ query: "test", collection: "decisions", threshold: 0.999, embedder, store });
    assert.ok(low.length >= high.length);
  });
});

describe("manage_strategies", () => {
  it("reinforces a strategy on success", async () => {
    const strategyStore = new MockStrategyStore();
    const s = new Strategy({ id: "s1", pattern: "whatsapp down", action: "restart port-kill", weight: 0.5 });
    await strategyStore.save(s);

    const updated = await reinforceStrategy({ strategyId: "s1", success: true, strategyStore });
    assert.ok(updated.weight > 0.5);
    assert.strictEqual(updated.successes, 1);
  });

  it("weakens a strategy on failure", async () => {
    const strategyStore = new MockStrategyStore();
    const s = new Strategy({ id: "s1", pattern: "cron down", action: "restart", weight: 0.5 });
    await strategyStore.save(s);

    const updated = await reinforceStrategy({ strategyId: "s1", success: false, strategyStore });
    assert.ok(updated.weight < 0.5);
    assert.strictEqual(updated.failures, 1);
  });

  it("registers a new strategy with vector embedding", async () => {
    const strategyStore = new MockStrategyStore();
    const embedder = new MockEmbedder();
    const vectorStore = new MockVectorStore();

    const strategy = await registerStrategy({
      pattern: "service down and process not found",
      action: "kill port and restart",
      strategyStore, embedder, vectorStore,
    });

    assert.ok(strategy.id.startsWith("strat-"));
    assert.strictEqual(strategy.weight, 0.5);
    assert.strictEqual(await vectorStore.count("strategies"), 1);
  });

  it("decays unused strategies", async () => {
    const strategyStore = new MockStrategyStore();
    const s = new Strategy({
      id: "s1", pattern: "test", action: "test", weight: 0.8,
      lastUsed: new Date(Date.now() - 60 * 86_400_000).toISOString(), // 60 days ago
    });
    await strategyStore.save(s);

    await decayStrategies({ strategyStore, halfLifeDays: 30 });
    const all = await strategyStore.loadAll();
    assert.ok(all[0].weight < 0.3); // decayed from 0.8 after 2 half-lives
  });
});

describe("Strategy entity", () => {
  it("reinforce increases weight asymptotically toward 1", () => {
    let s = new Strategy({ id: "s", pattern: "p", action: "a", weight: 0.9 });
    s = s.reinforce();
    assert.ok(s.weight > 0.9 && s.weight < 1.0);
  });

  it("weaken decreases weight", () => {
    let s = new Strategy({ id: "s", pattern: "p", action: "a", weight: 0.3 });
    s = s.weaken();
    assert.strictEqual(s.weight, 0.25);
  });

  it("confidence is successes / total", () => {
    const s = new Strategy({ id: "s", pattern: "p", action: "a", successes: 8, failures: 2 });
    assert.strictEqual(s.confidence(), 0.8);
  });

  it("score combines weight and confidence", () => {
    const strong = new Strategy({ id: "s", pattern: "p", action: "a", weight: 0.9, successes: 9, failures: 1 });
    const weak = new Strategy({ id: "s2", pattern: "p", action: "a", weight: 0.2, successes: 1, failures: 9 });
    assert.ok(strong.score() > weak.score());
  });
});

describe("manage_cognitive", () => {
  it("saves and loads cognitive state", async () => {
    const store = new MockCognitiveStore();
    const state = new CognitiveState({
      reflection: { session: "test-session", quality: "productive" },
      attention: { priorities: ["fix whatsapp"] },
    });

    await saveCognitiveState({ state, cognitiveStore: store });
    const loaded = await loadCognitiveState({ cognitiveStore: store });
    assert.strictEqual(loaded.reflection.session, "test-session");
    assert.strictEqual(loaded.attention.priorities[0], "fix whatsapp");
  });

  it("generates boot brief from cognitive state", async () => {
    const store = new MockCognitiveStore();
    store.state = new CognitiveState({
      reflection: { session: "nervous-migration", quality: "transformative", achievement: "6-organ restructure" },
      attention: { priorities: ["validate boot", "git init organs"] },
      calibration: { biases: ["defaults to safe approach"] },
    });

    const brief = await generateBootBrief({ cognitiveStore: store });
    assert.ok(brief.includes("nervous-migration"));
    assert.ok(brief.includes("transformative"));
    assert.ok(brief.includes("validate boot"));
    assert.ok(brief.includes("defaults to safe"));
  });

  it("appends and retrieves decisions", async () => {
    const store = new MockCognitiveStore();
    await store.appendDecision({ id: "d1", type: "action", reasoning: "restart whatsapp" });
    await store.appendDecision({ id: "d2", type: "escalation", reasoning: "alert PM" });

    const recent = await store.recentDecisions(5);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].id, "d2"); // most recent first
  });

  it("filters decisions by tag", async () => {
    const store = new MockCognitiveStore();
    await appendDecision({ entry: { type: "arch", what: "use SQLite", tags: ["database", "choice"] }, cognitiveStore: store });
    await appendDecision({ entry: { type: "arch", what: "use TOML", tags: ["data-format"] }, cognitiveStore: store });
    await appendDecision({ entry: { type: "op", what: "restart", tags: ["database"] }, cognitiveStore: store });

    const dbDecisions = await getDecisionsByTag({ tag: "database", cognitiveStore: store });
    assert.strictEqual(dbDecisions.length, 2);
    assert.strictEqual(dbDecisions[0].what, "restart"); // most recent first
  });

  it("links outcome to a decision", async () => {
    const store = new MockCognitiveStore();
    const id = await appendDecision({ entry: { type: "arch", what: "choose SQLite", confidence: 0.8 }, cognitiveStore: store });

    const ok = await linkDecisionOutcome({ decisionId: id, outcome: "worked well, no scaling issues", quality: "correct", cognitiveStore: store });
    assert.strictEqual(ok, true);

    const recent = await getRecentDecisions({ limit: 1, cognitiveStore: store });
    assert.strictEqual(recent[0].outcomeQuality, "correct");
    assert.ok(recent[0].outcomeTimestamp);
  });

  it("linkOutcome returns false for unknown decision id", async () => {
    const store = new MockCognitiveStore();
    const ok = await linkDecisionOutcome({ decisionId: "nonexistent", outcome: "x", quality: "correct", cognitiveStore: store });
    assert.strictEqual(ok, false);
  });

  it("computes decision statistics", async () => {
    const store = new MockCognitiveStore();
    await appendDecision({ entry: { type: "arch", what: "a", confidence: 0.9 }, cognitiveStore: store });
    await appendDecision({ entry: { type: "arch", what: "b", confidence: 0.6 }, cognitiveStore: store });
    await appendDecision({ entry: { type: "op", what: "c", confidence: 0.5 }, cognitiveStore: store });
    const last = await appendDecision({ entry: { type: "arch", what: "d", confidence: 0.7 }, cognitiveStore: store });
    await linkDecisionOutcome({ decisionId: last, outcome: "good", quality: "correct", cognitiveStore: store });

    const stats = await getDecisionStats({ cognitiveStore: store });
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.byType.arch, 3);
    assert.strictEqual(stats.byType.op, 1);
    assert.strictEqual(stats.byQuality.correct, 1);
    assert.ok(Math.abs(stats.avgConfidence - 0.675) < 0.01);
  });
});

// ─── DecisionFramework entity ───

describe("DecisionFramework", () => {
  it("requires id and name", () => {
    assert.throws(() => new DecisionFramework({ name: "x" }), /id is required/);
    assert.throws(() => new DecisionFramework({ id: "x" }), /name is required/);
  });

  it("constructs with defaults", () => {
    const fw = new DecisionFramework({ id: "build_vs_buy", name: "Build vs Buy" });
    assert.strictEqual(fw.id, "build_vs_buy");
    assert.strictEqual(fw.weight, 0.5);
    assert.strictEqual(fw.successes, 0);
    assert.strictEqual(fw.failures, 0);
    assert.ok(fw.createdAt);
  });

  it("clamps weight with 0.05 floor to avoid total erasure", () => {
    const low = new DecisionFramework({ id: "a", name: "A", weight: 0.01 });
    assert.strictEqual(low.weight, 0.05);
    const high = new DecisionFramework({ id: "b", name: "B", weight: 1.5 });
    assert.strictEqual(high.weight, 1);
  });

  it("reinforce with logarithmic dampening", () => {
    const fw = new DecisionFramework({ id: "a", name: "A", weight: 0.5 });
    const r = fw.reinforce();
    // 0.5 + 0.1 * 0.5 = 0.55
    assert.ok(Math.abs(r.weight - 0.55) < 0.001);
    assert.strictEqual(r.successes, 1);
    assert.strictEqual(fw.weight, 0.5); // immutable
  });

  it("weaken floors at 0.05", () => {
    const fw = new DecisionFramework({ id: "a", name: "A", weight: 0.07 });
    const w = fw.weaken();
    assert.strictEqual(w.weight, 0.05); // max(0.05, 0.07 - 0.05)
    assert.strictEqual(w.failures, 1);
  });

  it("decay with half-life", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const fw = new DecisionFramework({ id: "a", name: "A", weight: 1.0, lastUsed: twoWeeksAgo });
    const d = fw.decay(14); // exactly 1 half-life
    // weight should be ~0.5
    assert.ok(Math.abs(d.weight - 0.5) < 0.05);
  });

  it("decay returns unchanged for recently-used frameworks", () => {
    const fw = new DecisionFramework({ id: "a", name: "A", weight: 0.8, lastUsed: new Date().toISOString() });
    const d = fw.decay(30);
    assert.strictEqual(d, fw); // less than 1 day, returned as-is
  });

  it("confidence = successes / total", () => {
    const fw = new DecisionFramework({ id: "a", name: "A", successes: 7, failures: 3 });
    assert.strictEqual(fw.confidence(), 0.7);
  });

  it("score combines weight and confidence", () => {
    const solid = new DecisionFramework({ id: "a", name: "A", weight: 0.9, successes: 9, failures: 1 });
    const weak = new DecisionFramework({ id: "b", name: "B", weight: 0.2, successes: 1, failures: 9 });
    assert.ok(solid.score() > weak.score());
  });
});

// ─── Decision framework use cases ───

describe("manage_cognitive frameworks", () => {
  it("registerFramework creates and updates", async () => {
    const store = new MockCognitiveStore();
    const fw1 = await registerFramework({ id: "build_vs_buy", name: "Build vs Buy", description: "When to build", cognitiveStore: store });
    assert.strictEqual(fw1.weight, 0.5);
    assert.strictEqual(fw1.description, "When to build");

    // Re-register updates metadata without resetting weight
    const reinforced = await reinforceFramework({ id: "build_vs_buy", cognitiveStore: store });
    assert.ok(reinforced.weight > 0.5);

    const fw2 = await registerFramework({ id: "build_vs_buy", name: "Build vs Buy (v2)", cognitiveStore: store });
    assert.strictEqual(fw2.name, "Build vs Buy (v2)");
    assert.ok(fw2.weight > 0.5); // weight preserved through re-register
  });

  it("reinforceFramework increases weight with Hebbian dampening", async () => {
    const store = new MockCognitiveStore();
    await registerFramework({ id: "a", name: "A", cognitiveStore: store });
    const r1 = await reinforceFramework({ id: "a", cognitiveStore: store });
    const r2 = await reinforceFramework({ id: "a", cognitiveStore: store });
    assert.ok(r2.weight > r1.weight);
    assert.strictEqual(r2.successes, 2);
  });

  it("weakenFramework decreases weight", async () => {
    const store = new MockCognitiveStore();
    await registerFramework({ id: "a", name: "A", cognitiveStore: store });
    const w = await weakenFramework({ id: "a", cognitiveStore: store });
    assert.ok(w.weight < 0.5);
    assert.strictEqual(w.failures, 1);
  });

  it("reinforceFramework returns null for missing framework", async () => {
    const store = new MockCognitiveStore();
    const r = await reinforceFramework({ id: "missing", cognitiveStore: store });
    assert.strictEqual(r, null);
  });

  it("decayFrameworks applies time-based decay to all", async () => {
    const store = new MockCognitiveStore();
    // Pre-seed with a framework that has an old lastUsed
    const oldFw = new DecisionFramework({
      id: "old", name: "Old",
      weight: 1.0,
      lastUsed: new Date(Date.now() - 60 * 86400000).toISOString(), // 60 days ago
    });
    await store.saveFramework(oldFw);

    const result = await decayFrameworks({ halfLifeDays: 30, cognitiveStore: store });
    assert.ok(result.decayedCount >= 1);

    const decayed = await store.getFramework("old");
    assert.ok(decayed.weight < 1.0);
    // 60 days / 30-day half-life = 2 half-lives = 0.25
    assert.ok(Math.abs(decayed.weight - 0.25) < 0.05);
  });

  it("listFrameworks sorts by score descending", async () => {
    const store = new MockCognitiveStore();
    await store.saveFramework(new DecisionFramework({ id: "strong", name: "Strong", weight: 0.9, successes: 9, failures: 1 }));
    await store.saveFramework(new DecisionFramework({ id: "weak", name: "Weak", weight: 0.2, successes: 1, failures: 5 }));
    await store.saveFramework(new DecisionFramework({ id: "mid", name: "Mid", weight: 0.6, successes: 5, failures: 3 }));

    const list = await listFrameworks({ cognitiveStore: store });
    assert.strictEqual(list.length, 3);
    assert.strictEqual(list[0].id, "strong");
    assert.strictEqual(list[2].id, "weak");
  });

  it("boot brief includes frameworks and recent decisions", async () => {
    const store = new MockCognitiveStore();
    store.state = new CognitiveState({
      reflection: { session: "sess-1", quality: "productive" },
    });
    await store.saveFramework(new DecisionFramework({ id: "build_vs_buy", name: "Build vs Buy", weight: 0.9, successes: 9, failures: 1 }));
    await store.appendDecision({ id: "d1", type: "arch", what: "choose SQLite" });

    const brief = await generateBootBrief({ cognitiveStore: store });
    assert.ok(brief.includes("Build vs Buy"));
    assert.ok(brief.includes("choose SQLite"));
    assert.ok(brief.includes("sess-1"));
  });
});
