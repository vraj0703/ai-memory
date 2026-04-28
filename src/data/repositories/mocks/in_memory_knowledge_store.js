/**
 * InMemoryKnowledgeStore — default mock for TOMLKnowledgeStore.
 *
 * Holds capability manifests in memory. Ships with one seed manifest so
 * search_knowledge returns something useful out of the box.
 */

class InMemoryKnowledgeStore {
  constructor() {
    this._manifests = new Map();
    // Seed with one example capability so consumers see a non-empty result.
    this._manifests.set("seed-example", {
      id: "seed-example",
      name: "Example tool",
      kind: "example",
      description: "[mock] seeded capability so search_knowledge returns at least one hit",
      mock: true,
    });
  }

  async list() {
    return Array.from(this._manifests.values());
  }

  async get(id) {
    return this._manifests.get(id) || null;
  }

  async upsert(capability) {
    this._manifests.set(capability.id, { ...capability, mock: true });
    return capability.id;
  }

  async search(query) {
    if (!query) return Array.from(this._manifests.values());
    const q = String(query).toLowerCase();
    return Array.from(this._manifests.values()).filter(
      (c) => c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
    );
  }
}

module.exports = { InMemoryKnowledgeStore };
