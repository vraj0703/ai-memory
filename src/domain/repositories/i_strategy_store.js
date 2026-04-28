/**
 * IStrategyStore — abstract interface for persisting learned strategies.
 */
class IStrategyStore {
  /** @returns {Promise<import('../entities/strategy').Strategy[]>} */
  async loadAll() { throw new Error("not implemented"); }

  /** @param {import('../entities/strategy').Strategy} strategy */
  async save(strategy) { throw new Error("not implemented"); }

  /** @param {string} id @param {"reinforce"|"weaken"} action */
  async update(id, action) { throw new Error("not implemented"); }

  /** Apply time-based decay to all strategies */
  async decayAll(halfLifeDays) { throw new Error("not implemented"); }
}

module.exports = { IStrategyStore };
