/**
 * IVectorStore — abstract interface for semantic memory storage and retrieval.
 */
class IVectorStore {
  /** @param {import('../entities/memory_item').MemoryItem} item */
  async store(item) { throw new Error("not implemented"); }

  /**
   * Semantic search.
   * @param {Float32Array|number[]} queryEmbedding
   * @param {string} collection
   * @param {number} [topK=5]
   * @returns {Promise<{item: import('../entities/memory_item').MemoryItem, similarity: number}[]>}
   */
  async search(queryEmbedding, collection, topK) { throw new Error("not implemented"); }

  /** @param {string} id */
  async delete(id) { throw new Error("not implemented"); }

  /** @param {string} collection @returns {Promise<number>} */
  async count(collection) { throw new Error("not implemented"); }
}

module.exports = { IVectorStore };
