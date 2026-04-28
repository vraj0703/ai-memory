/**
 * IRemoteStateStore — abstract interface for off-device versioned state persistence.
 *
 * Optional secondary backend (e.g., NextCloud HTTP wrapper). v2/memory primarily
 * uses SQLite locally; this adds cross-device backups for cognitive state and
 * other domain-scoped key/value data.
 */
class IRemoteStateStore {
  /** @returns {Promise<boolean>} */
  async isAvailable() { throw new Error("not implemented"); }

  /**
   * Save a value to a domain-scoped key. Previous value auto-versioned.
   * @param {string} domain
   * @param {string} key
   * @param {any} data
   * @returns {Promise<boolean>}
   */
  async save(domain, key, data) { throw new Error("not implemented"); }

  /**
   * Load the latest value for a domain-scoped key.
   * @param {string} domain
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async load(domain, key) { throw new Error("not implemented"); }

  /**
   * List all keys within a domain.
   * @param {string} domain
   * @returns {Promise<string[]>}
   */
  async listKeys(domain) { throw new Error("not implemented"); }

  /**
   * List versioned snapshots for a domain/key pair.
   * @param {string} domain
   * @param {string} key
   * @returns {Promise<{timestamp: string, size: number}[]>}
   */
  async listVersions(domain, key) { throw new Error("not implemented"); }
}

module.exports = { IRemoteStateStore };
