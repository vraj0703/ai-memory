/**
 * IKnowledgeStore — abstract interface for capability/knowledge lookup.
 */
class IKnowledgeStore {
  /** @returns {Promise<import('../entities/capability').Capability[]>} */
  async loadAll() { throw new Error("not implemented"); }

  /** @param {string} query @returns {Promise<import('../entities/capability').Capability[]>} */
  async search(query) { throw new Error("not implemented"); }

  /** @param {string} id @returns {Promise<import('../entities/capability').Capability|null>} */
  async getById(id) { throw new Error("not implemented"); }

  /** @param {string} category @returns {Promise<import('../entities/capability').Capability[]>} */
  async getByCategory(category) { throw new Error("not implemented"); }

  /** @returns {Promise<{total: number, active: number, categories: string[]}>} */
  async stats() { throw new Error("not implemented"); }
}

module.exports = { IKnowledgeStore };
