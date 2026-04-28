/**
 * StubRemoteStateStore — default mock for NextCloudStateStore.
 *
 * No-op backups. Returns success without touching the network.
 */

class StubRemoteStateStore {
  constructor() {
    this._backups = [];
  }

  async backup({ domain, path: filePath, contents } = {}) {
    this._backups.push({ domain, path: filePath, size: contents?.length || 0, ts: new Date().toISOString() });
    return { ok: true, mock: true };
  }

  async list({ domain } = {}) {
    return this._backups.filter((b) => !domain || b.domain === domain);
  }

  async health() {
    return { status: "mock", mock: true };
  }
}

module.exports = { StubRemoteStateStore };
