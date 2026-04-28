/**
 * backup_to_remote — use cases for backing up / restoring cognitive state
 * to a remote versioned store (e.g., NextCloud).
 *
 * All functions are safe to call even when remoteStateStore is null — they
 * return a skipped result rather than throwing.
 */

/**
 * @param {object} deps
 * @param {import('../repositories/i_cognitive_store').ICognitiveStore} deps.cognitiveStore
 * @param {import('../repositories/i_remote_state_store').IRemoteStateStore|null} deps.remoteStateStore
 */
async function backupCognitiveState({ cognitiveStore, remoteStateStore }) {
  if (!remoteStateStore) return { skipped: true, reason: "no remote store" };
  const available = await remoteStateStore.isAvailable();
  if (!available) return { skipped: true, reason: "remote unreachable" };
  const state = await cognitiveStore.load();
  const ok = await remoteStateStore.save("cognitive", "latest", {
    reflection: state.reflection,
    attention: state.attention,
    calibration: state.calibration,
    backedUpAt: new Date().toISOString(),
  });
  return { ok, backedUpAt: new Date().toISOString() };
}

/**
 * @param {object} deps
 * @param {import('../repositories/i_remote_state_store').IRemoteStateStore|null} deps.remoteStateStore
 */
async function restoreCognitiveState({ remoteStateStore }) {
  if (!remoteStateStore) return null;
  return remoteStateStore.load("cognitive", "latest");
}

module.exports = { backupCognitiveState, restoreCognitiveState };
