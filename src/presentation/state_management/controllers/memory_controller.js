/**
 * MemoryController — exposes memory operations as methods for the HTTP layer.
 */
const { storeMemory } = require("../../../domain/use_cases/store_memory");
const { recallMemory } = require("../../../domain/use_cases/recall_memory");
const { reinforceStrategy, selectStrategy, registerStrategy, decayStrategies } = require("../../../domain/use_cases/manage_strategies");
const { saveCognitiveState, loadCognitiveState, generateBootBrief, appendDecision, getRecentDecisions } = require("../../../domain/use_cases/manage_cognitive");
const { CognitiveState } = require("../../../domain/entities/cognitive_state");
const { searchKnowledge, knowledgeStats, recommendForTask } = require("../../../domain/use_cases/search_knowledge");

class MemoryController {
  constructor(deps) {
    this.vectorStore = deps.vectorStore;
    this.embedder = deps.embedder;
    this.strategyStore = deps.strategyStore;
    this.cognitiveStore = deps.cognitiveStore;
    this.knowledgeStore = deps.knowledgeStore;
  }

  // ─── Vector memory ───

  async store(content, collection, metadata) {
    return storeMemory({ content, collection, metadata, embedder: this.embedder, store: this.vectorStore });
  }

  async recall(query, collection, topK = 5) {
    return recallMemory({ query, collection, topK, threshold: 0.5, embedder: this.embedder, store: this.vectorStore });
  }

  // ─── Strategies ───

  async getStrategies() {
    return this.strategyStore.loadAll();
  }

  async addStrategy(pattern, action) {
    return registerStrategy({ pattern, action, strategyStore: this.strategyStore, embedder: this.embedder, vectorStore: this.vectorStore });
  }

  async findStrategy(situation) {
    return selectStrategy({ situation, embedder: this.embedder, vectorStore: this.vectorStore, strategyStore: this.strategyStore });
  }

  async reinforceStrategy(strategyId, success) {
    return reinforceStrategy({ strategyId, success, strategyStore: this.strategyStore });
  }

  async decayStrategies() {
    return decayStrategies({ strategyStore: this.strategyStore });
  }

  // ─── Cognitive state ───

  async getCognitive() {
    return loadCognitiveState({ cognitiveStore: this.cognitiveStore });
  }

  async saveCognitive(stateData) {
    const state = new CognitiveState(stateData);
    return saveCognitiveState({ state, cognitiveStore: this.cognitiveStore });
  }

  async getBootBrief() {
    return generateBootBrief({ cognitiveStore: this.cognitiveStore });
  }

  async logDecision(entry) {
    return appendDecision({ entry, cognitiveStore: this.cognitiveStore });
  }

  async recentDecisions(limit = 20) {
    return getRecentDecisions({ limit, cognitiveStore: this.cognitiveStore });
  }

  // ─── Knowledge ───

  async searchKnowledge(query) {
    return searchKnowledge({ query, knowledgeStore: this.knowledgeStore });
  }

  async getCapability(id) {
    return this.knowledgeStore.getById(id);
  }

  async listCapabilities() {
    return this.knowledgeStore.loadAll();
  }

  async knowledgeStats() {
    return knowledgeStats({ knowledgeStore: this.knowledgeStore });
  }

  async recommend(taskDescription) {
    return recommendForTask({ taskDescription, knowledgeStore: this.knowledgeStore });
  }

  // ─── Stats ───

  async getStats() {
    const [decisions, strategies, cognitive, knowledge] = await Promise.allSettled([
      this.vectorStore.count("decisions"),
      this.vectorStore.count("strategies"),
      this.cognitiveStore.load(),
      this.knowledgeStore.stats(),
    ]);

    return {
      vectorCounts: {
        decisions: decisions.status === "fulfilled" ? decisions.value : 0,
        strategies: strategies.status === "fulfilled" ? strategies.value : 0,
      },
      knowledge: knowledge.status === "fulfilled" ? knowledge.value : { total: 0, active: 0 },
      cognitiveLoaded: cognitive.status === "fulfilled" && !cognitive.value.isEmpty(),
      embeddingModel: this.embedder.model || "unknown",
    };
  }
}

module.exports = { MemoryController };
