/**
 * ManageStrategies — the self-evolving layer.
 *
 * Reinforce strategies that work. Weaken strategies that fail.
 * Decay unused strategies over time. Select the best strategy
 * for a given situation via semantic similarity.
 */
const { Strategy } = require("../entities/strategy");
const { STRATEGY_DECAY_HALF_LIFE_DAYS } = require("../constants");

/**
 * After an outcome, reinforce or weaken the matching strategy.
 *
 * @param {object} params
 * @param {string} params.strategyId
 * @param {boolean} params.success
 * @param {import('../repositories/i_strategy_store').IStrategyStore} params.strategyStore
 * @returns {Promise<Strategy>}
 */
async function reinforceStrategy({ strategyId, success, strategyStore }) {
  await strategyStore.update(strategyId, success ? "reinforce" : "weaken");
  const all = await strategyStore.loadAll();
  return all.find(s => s.id === strategyId) || null;
}

/**
 * Find the best strategy for a given situation.
 * Uses semantic search over strategy patterns.
 *
 * @param {object} params
 * @param {string} params.situation    - "whatsapp down, process_not_running"
 * @param {import('../repositories/i_embedding_provider').IEmbeddingProvider} params.embedder
 * @param {import('../repositories/i_vector_store').IVectorStore} params.vectorStore
 * @param {import('../repositories/i_strategy_store').IStrategyStore} params.strategyStore
 * @param {number} [params.topK=3]
 * @returns {Promise<{strategy: Strategy, similarity: number}[]>}
 */
async function selectStrategy({ situation, embedder, vectorStore, strategyStore, topK = 3 }) {
  const queryEmb = await embedder.embed(situation);
  const hits = await vectorStore.search(queryEmb, "strategies", topK);

  // Enrich with live strategy weights
  const allStrategies = await strategyStore.loadAll();
  const strategyMap = new Map(allStrategies.map(s => [s.id, s]));

  return hits
    .filter(h => strategyMap.has(h.item.metadata?.strategyId))
    .map(h => ({
      strategy: strategyMap.get(h.item.metadata.strategyId),
      similarity: h.similarity,
    }))
    .sort((a, b) => b.strategy.score() - a.strategy.score());
}

/**
 * Apply time-based decay to all strategies.
 */
async function decayStrategies({ strategyStore, halfLifeDays = STRATEGY_DECAY_HALF_LIFE_DAYS }) {
  await strategyStore.decayAll(halfLifeDays);
}

/**
 * Register a new strategy (from mind's experience or LLM suggestion).
 */
async function registerStrategy({ pattern, action, strategyStore, embedder, vectorStore }) {
  const strategy = new Strategy({
    id: `strat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pattern,
    action,
    weight: 0.5,
  });

  await strategyStore.save(strategy);

  // Also store the pattern in vector DB for semantic matching
  const { storeMemory } = require("./store_memory");
  await storeMemory({
    content: pattern,
    collection: "strategies",
    metadata: { strategyId: strategy.id, action },
    embedder,
    store: vectorStore,
  });

  return strategy;
}

module.exports = { reinforceStrategy, selectStrategy, decayStrategies, registerStrategy };
