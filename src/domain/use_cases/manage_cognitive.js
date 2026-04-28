/**
 * ManageCognitive — persist and restore Mr. V's cognitive state.
 *
 * Wraps reflection/attention/calibration, decision journal (JSONL with outcome
 * linking and tag queries), and decision frameworks (Hebbian-learned patterns).
 *
 * All functions are pure with dependencies injected.
 */
const { CognitiveState } = require("../entities/cognitive_state");
const { DecisionFramework } = require("../entities/decision_framework");

// ─── Cognitive state ───

async function saveCognitiveState({ state, cognitiveStore }) {
  await cognitiveStore.save(state);
  return state;
}

async function loadCognitiveState({ cognitiveStore }) {
  return cognitiveStore.load();
}

// ─── Decision journal ───

async function appendDecision({ entry, cognitiveStore }) {
  return cognitiveStore.appendDecision(entry);
}

async function getRecentDecisions({ limit = 20, cognitiveStore }) {
  return cognitiveStore.recentDecisions(limit);
}

async function getDecisionsByTag({ tag, cognitiveStore }) {
  return cognitiveStore.decisionsByTag(tag);
}

async function linkDecisionOutcome({ decisionId, outcome, quality, cognitiveStore }) {
  return cognitiveStore.linkOutcome(decisionId, outcome, quality);
}

async function getDecisionStats({ cognitiveStore }) {
  return cognitiveStore.decisionStats();
}

// ─── Decision frameworks (Hebbian learning) ───

/**
 * Upsert a decision framework. If it exists, merge updates.
 */
async function registerFramework({ id, name, description, cognitiveStore }) {
  const existing = await cognitiveStore.getFramework(id);
  const fw = existing
    ? new DecisionFramework({ ...existing, name: name || existing.name, description: description || existing.description })
    : new DecisionFramework({ id, name, description });
  await cognitiveStore.saveFramework(fw);
  return fw;
}

async function reinforceFramework({ id, cognitiveStore }) {
  const fw = await cognitiveStore.getFramework(id);
  if (!fw) return null;
  const reinforced = fw.reinforce();
  await cognitiveStore.saveFramework(reinforced);
  return reinforced;
}

async function weakenFramework({ id, cognitiveStore }) {
  const fw = await cognitiveStore.getFramework(id);
  if (!fw) return null;
  const weakened = fw.weaken();
  await cognitiveStore.saveFramework(weakened);
  return weakened;
}

async function decayFrameworks({ halfLifeDays = 30, cognitiveStore }) {
  const all = await cognitiveStore.loadFrameworks();
  let decayedCount = 0;
  for (const fw of all) {
    const decayed = fw.decay(halfLifeDays);
    if (decayed.weight !== fw.weight) {
      await cognitiveStore.saveFramework(decayed);
      decayedCount++;
    }
  }
  return { decayedCount, totalFrameworks: all.length };
}

async function listFrameworks({ cognitiveStore }) {
  const all = await cognitiveStore.loadFrameworks();
  return all.sort((a, b) => b.score() - a.score());
}

// ─── Boot brief ───

/**
 * Generate a rich cognitive brief including frameworks and recent decisions.
 * Injected into the next session's boot prompt.
 */
async function generateBootBrief({ cognitiveStore, recentLimit = 5 }) {
  const [state, frameworks, recent] = await Promise.all([
    cognitiveStore.load(),
    cognitiveStore.loadFrameworks(),
    cognitiveStore.recentDecisions(recentLimit),
  ]);
  return state.getBrief({ recentDecisions: recent, frameworks });
}

module.exports = {
  saveCognitiveState,
  loadCognitiveState,
  appendDecision,
  getRecentDecisions,
  getDecisionsByTag,
  linkDecisionOutcome,
  getDecisionStats,
  registerFramework,
  reinforceFramework,
  weakenFramework,
  decayFrameworks,
  listFrameworks,
  generateBootBrief,
};
