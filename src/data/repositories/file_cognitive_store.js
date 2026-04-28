/**
 * FileCognitiveStore — persists cognitive state as JSON files + JSONL decision journal.
 *
 * Layout (under <root>/):
 *   reflection.json           — current session reflection
 *   attention.json            — next session attention primer
 *   calibration.json          — accumulated self-knowledge
 *   decision-journal.jsonl    — append-only decision log
 *   frameworks.json           — Hebbian-learned decision frameworks (keyed by id)
 */
const fs = require("fs");
const path = require("path");
const { ICognitiveStore } = require("../../domain/repositories/i_cognitive_store");
const { CognitiveState } = require("../../domain/entities/cognitive_state");
const { DecisionFramework } = require("../../domain/entities/decision_framework");

class FileCognitiveStore extends ICognitiveStore {
  constructor(opts = {}) {
    super();
    const root = opts.root || path.resolve(process.cwd(), "memory", "data", "data_sources", "local", "cognitive");
    fs.mkdirSync(root, { recursive: true });

    this.root = root;
    this.reflectionPath = path.join(root, "reflection.json");
    this.attentionPath = path.join(root, "attention.json");
    this.calibrationPath = path.join(root, "calibration.json");
    this.journalPath = path.join(root, "decision-journal.jsonl");
    this.frameworksPath = path.join(root, "frameworks.json");
  }

  // ─── Cognitive state (reflection / attention / calibration) ───

  async load() {
    return new CognitiveState({
      reflection: this._readJson(this.reflectionPath),
      attention: this._readJson(this.attentionPath),
      calibration: this._readJson(this.calibrationPath),
    });
  }

  async save(state) {
    this._writeJson(this.reflectionPath, state.reflection);
    this._writeJson(this.attentionPath, state.attention);
    this._writeJson(this.calibrationPath, state.calibration);
  }

  // ─── Decision journal (JSONL, crash-safe append) ───

  async appendDecision(entry) {
    const id = entry.id || this._generateDecisionId();
    const record = {
      id,
      timestamp: entry.timestamp || new Date().toISOString(),
      sessionId: entry.sessionId || entry.session_id || "unknown",
      type: entry.type || "general",
      what: entry.what || entry.title || "",
      why: entry.why || "",
      alternativesRejected: entry.alternativesRejected || entry.alternatives_rejected || [],
      confidence: typeof entry.confidence === "number" ? entry.confidence : 0.5,
      pmInvolved: entry.pmInvolved || entry.pm_involved || false,
      outcome: entry.outcome || null,
      outcomeTimestamp: entry.outcomeTimestamp || null,
      outcomeQuality: entry.outcomeQuality || null,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    };

    fs.appendFileSync(this.journalPath, JSON.stringify(record) + "\n", "utf-8");
    return id;
  }

  async recentDecisions(limit = 20) {
    const lines = this._readJsonlLines(this.journalPath);
    return lines.slice(-limit).reverse()
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  }

  async decisionsByTag(tag) {
    const lines = this._readJsonlLines(this.journalPath);
    const out = [];
    for (const l of lines) {
      try {
        const entry = JSON.parse(l);
        if (Array.isArray(entry.tags) && entry.tags.includes(tag)) out.push(entry);
      } catch { /* skip corrupt */ }
    }
    return out.reverse();
  }

  async linkOutcome(decisionId, outcome, quality) {
    if (!fs.existsSync(this.journalPath)) return false;
    const content = fs.readFileSync(this.journalPath, "utf-8");
    const lines = content.split("\n");
    let found = false;

    const updated = lines.map((line) => {
      if (!line.trim()) return line;
      try {
        const entry = JSON.parse(line);
        if (entry.id === decisionId) {
          entry.outcome = outcome;
          entry.outcomeTimestamp = new Date().toISOString();
          entry.outcomeQuality = quality;
          found = true;
          return JSON.stringify(entry);
        }
        return line;
      } catch {
        return line;
      }
    });

    if (found) {
      fs.writeFileSync(this.journalPath, updated.join("\n"), "utf-8");
    }
    return found;
  }

  async decisionStats() {
    const lines = this._readJsonlLines(this.journalPath);
    if (lines.length === 0) return { total: 0, byType: {}, byQuality: {}, avgConfidence: 0 };

    const byType = {};
    const byQuality = {};
    let totalConfidence = 0;
    let confidenceCount = 0;
    let total = 0;

    for (const l of lines) {
      try {
        const d = JSON.parse(l);
        total++;
        byType[d.type || "general"] = (byType[d.type || "general"] || 0) + 1;
        const quality = d.outcomeQuality || d.outcome_quality;
        if (quality) byQuality[quality] = (byQuality[quality] || 0) + 1;
        if (typeof d.confidence === "number") {
          totalConfidence += d.confidence;
          confidenceCount++;
        }
      } catch { /* skip corrupt */ }
    }

    return {
      total,
      byType,
      byQuality,
      avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }

  // ─── Decision Frameworks (Hebbian) ───

  async loadFrameworks() {
    const data = this._readJson(this.frameworksPath);
    if (!data || typeof data !== "object") return [];
    return Object.values(data).map(raw => new DecisionFramework(raw));
  }

  async saveFramework(framework) {
    const data = this._readJson(this.frameworksPath) || {};
    data[framework.id] = {
      id: framework.id,
      name: framework.name,
      description: framework.description,
      weight: framework.weight,
      successes: framework.successes,
      failures: framework.failures,
      lastUsed: framework.lastUsed,
      createdAt: framework.createdAt,
    };
    this._writeJson(this.frameworksPath, data);
  }

  async getFramework(id) {
    const data = this._readJson(this.frameworksPath);
    if (!data || !data[id]) return null;
    return new DecisionFramework(data[id]);
  }

  // ─── Helpers ───

  _readJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { return {}; }
  }

  _writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  _readJsonlLines(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, "utf-8").split("\n").filter(l => l.trim());
  }

  _generateDecisionId() {
    const date = new Date().toISOString().split("T")[0];
    const ms = Date.now().toString(36).slice(-4);
    const rnd = Math.random().toString(36).slice(2, 5);
    return `dj-${date}-${ms}${rnd}`;
  }
}

module.exports = { FileCognitiveStore };
