/**
 * TOMLKnowledgeStore — reads capability manifests from memory/knowledge/manifests/*.toml
 */

const fs = require("fs");
const path = require("path");
const TOML = require("smol-toml");
const { IKnowledgeStore } = require("../../domain/repositories/i_knowledge_store");
const { Capability } = require("../../domain/entities/capability");

class TOMLKnowledgeStore extends IKnowledgeStore {
  constructor(opts = {}) {
    super();
    this.manifestsDir = opts.manifestsDir || path.resolve(process.cwd(), "memory", "knowledge", "manifests");
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = opts.cacheTTL || 60_000; // refresh every 60s
  }

  async loadAll() {
    return this._loadWithCache();
  }

  async search(query) {
    const all = await this.loadAll();
    return all.filter(c => c.matchesQuery(query));
  }

  async getById(id) {
    const all = await this.loadAll();
    return all.find(c => c.id === id) || null;
  }

  async getByCategory(category) {
    const all = await this.loadAll();
    return all.filter(c => c.category.toLowerCase() === category.toLowerCase());
  }

  async stats() {
    const all = await this.loadAll();
    const active = all.filter(c => c.isActive());
    const categories = [...new Set(all.map(c => c.category))].sort();
    return { total: all.length, active: active.length, categories };
  }

  _loadWithCache() {
    const now = Date.now();
    if (this._cache && now - this._cacheTime < this._cacheTTL) {
      return this._cache;
    }
    this._cache = this._loadFromDisk();
    this._cacheTime = now;
    return this._cache;
  }

  _loadFromDisk() {
    if (!fs.existsSync(this.manifestsDir)) return [];

    const files = fs.readdirSync(this.manifestsDir).filter(f => f.endsWith(".toml"));
    const capabilities = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.manifestsDir, file), "utf-8");
        const data = TOML.parse(content);
        const cap = data.capability || {};
        const integration = data.integration || {};
        const consumers = data.consumers || {};
        const usage = data.usage || {};
        const evaluation = data.evaluation || null;

        capabilities.push(new Capability({
          id: cap.id || path.basename(file, ".toml"),
          name: cap.name || cap.id || file,
          url: cap.url,
          tier: cap.tier,
          status: cap.status || "enabled",
          free: cap.free,
          category: cap.category || "uncategorized",
          description: cap.description || "",
          method: integration.method,
          authType: integration.auth_type,
          adapter: integration.adapter,
          ministers: consumers.ministers || [],
          sherpas: consumers.sherpas || [],
          useCount: usage.use_count || 0,
          lastUsed: usage.last_used || null,
          evaluation,
        }));
      } catch {
        // Skip malformed manifests
      }
    }

    return capabilities;
  }
}

module.exports = { TOMLKnowledgeStore };
