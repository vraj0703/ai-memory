/**
 * ICognitiveStore — abstract interface for Mr. V's cognitive state persistence.
 *
 * Holds reflection/attention/calibration, plus the decision journal (JSONL)
 * and decision frameworks (Hebbian-learned recurring patterns).
 */
class ICognitiveStore {
  /** @returns {Promise<import('../entities/cognitive_state').CognitiveState>} */
  async load() { throw new Error("not implemented"); }

  /** @param {import('../entities/cognitive_state').CognitiveState} state */
  async save(state) { throw new Error("not implemented"); }

  // ─── Decision Journal (JSONL, append-only) ───

  /**
   * Append a decision entry. Returns the generated decision id.
   * @param {object} entry
   * @returns {Promise<string>} decision id
   */
  async appendDecision(entry) { throw new Error("not implemented"); }

  /**
   * @param {number} [limit=20]
   * @returns {Promise<object[]>} most-recent-first
   */
  async recentDecisions(limit) { throw new Error("not implemented"); }

  /**
   * @param {string} tag
   * @returns {Promise<object[]>}
   */
  async decisionsByTag(tag) { throw new Error("not implemented"); }

  /**
   * Update an existing decision with its outcome.
   * @param {string} decisionId
   * @param {string} outcome   - free-text description
   * @param {string} quality   - "correct" | "incorrect" | "partial" | "unknown"
   * @returns {Promise<boolean>} true if found and updated
   */
  async linkOutcome(decisionId, outcome, quality) { throw new Error("not implemented"); }

  /**
   * Aggregate stats across the decision journal.
   * @returns {Promise<{total: number, byType: object, byQuality: object, avgConfidence: number}>}
   */
  async decisionStats() { throw new Error("not implemented"); }

  // ─── Decision Frameworks (Hebbian-learned) ───

  /** @returns {Promise<import('../entities/decision_framework').DecisionFramework[]>} */
  async loadFrameworks() { throw new Error("not implemented"); }

  /**
   * Upsert a framework.
   * @param {import('../entities/decision_framework').DecisionFramework} framework
   */
  async saveFramework(framework) { throw new Error("not implemented"); }

  /**
   * @param {string} id
   * @returns {Promise<import('../entities/decision_framework').DecisionFramework|null>}
   */
  async getFramework(id) { throw new Error("not implemented"); }
}

module.exports = { ICognitiveStore };
