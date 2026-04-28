/**
 * InMemoryStrategyStore — default mock for SQLiteStrategyStore.
 */

class InMemoryStrategyStore {
  constructor() {
    this._strategies = new Map();
  }

  async upsert(strategy) {
    this._strategies.set(strategy.id, { ...strategy, mock: true });
    return strategy.id;
  }

  async get(id) {
    return this._strategies.get(id) || null;
  }

  async list() {
    return Array.from(this._strategies.values());
  }

  async delete(id) {
    return this._strategies.delete(id);
  }

  async reinforce(id, amount) {
    const s = this._strategies.get(id);
    if (!s) return null;
    s.weight = Math.min(1.0, (s.weight || 0) + amount);
    return s;
  }

  async weaken(id, amount) {
    const s = this._strategies.get(id);
    if (!s) return null;
    s.weight = Math.max(0, (s.weight || 0) - amount);
    return s;
  }
}

module.exports = { InMemoryStrategyStore };
