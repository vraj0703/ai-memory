/**
 * SearchKnowledge — find capabilities by query, category, or semantic similarity.
 */

/**
 * Text search over capabilities.
 * @param {object} params
 * @param {string} params.query
 * @param {import('../repositories/i_knowledge_store').IKnowledgeStore} params.knowledgeStore
 * @returns {Promise<import('../entities/capability').Capability[]>}
 */
async function searchKnowledge({ query, knowledgeStore }) {
  return knowledgeStore.search(query);
}

/**
 * Semantic search — embed query and find similar capabilities.
 * Falls back to text search if embeddings unavailable.
 */
async function semanticSearchKnowledge({ query, knowledgeStore, embedder, vectorStore, topK = 5 }) {
  try {
    const { recallMemory } = require("./recall_memory");
    const results = await recallMemory({
      query,
      collection: "knowledge",
      topK,
      threshold: 0.6,
      embedder,
      store: vectorStore,
    });
    if (results.length > 0) return results;
  } catch {
    // Embeddings unavailable — fall through to text search
  }
  // Fallback: text search
  return (await knowledgeStore.search(query)).map(cap => ({ item: { content: cap.description, metadata: { id: cap.id, name: cap.name } }, similarity: 1.0 }));
}

/**
 * Get knowledge stats.
 */
async function knowledgeStats({ knowledgeStore }) {
  return knowledgeStore.stats();
}

/**
 * Recommend capabilities for a task.
 */
async function recommendForTask({ taskDescription, knowledgeStore }) {
  const all = await knowledgeStore.loadAll();
  const active = all.filter(c => c.isActive());
  const matches = active.filter(c => c.matchesQuery(taskDescription));
  return matches.slice(0, 5);
}

module.exports = { searchKnowledge, semanticSearchKnowledge, knowledgeStats, recommendForTask };
