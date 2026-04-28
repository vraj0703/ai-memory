function registerRoutes(app, { memory }) {
  app.get("/health", (req, res) => {
    res.json({ status: "running", service: "memory-v2", version: "2.0.0" });
  });

  app.get("/stats", async (req, res) => {
    res.json(await memory.getStats());
  });

  // ─── Vector memory ───
  app.post("/store", async (req, res) => {
    try {
      const { content, collection, metadata } = req.body;
      const item = await memory.store(content, collection, metadata);
      res.json({ stored: true, id: item.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/recall", async (req, res) => {
    try {
      const { query, collection, topK } = req.body;
      const results = await memory.recall(query, collection, topK);
      res.json(results.map(r => ({ content: r.item.content, similarity: r.similarity, metadata: r.item.metadata, id: r.item.id })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Strategies ───
  app.get("/strategies", async (req, res) => {
    res.json(await memory.getStrategies());
  });

  app.post("/strategies", async (req, res) => {
    try {
      const { pattern, action } = req.body;
      const strategy = await memory.addStrategy(pattern, action);
      res.json(strategy);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/strategies/:id/reinforce", async (req, res) => {
    try {
      const updated = await memory.reinforceStrategy(req.params.id, req.body.success !== false);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/strategies/find", async (req, res) => {
    try {
      const results = await memory.findStrategy(req.body.situation);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Knowledge ───
  app.get("/knowledge", async (req, res) => {
    res.json(await memory.listCapabilities());
  });

  app.get("/knowledge/stats", async (req, res) => {
    res.json(await memory.knowledgeStats());
  });

  app.get("/knowledge/search", async (req, res) => {
    const q = req.query.q || req.query.query || "";
    if (!q) return res.status(400).json({ error: "query parameter q required" });
    res.json(await memory.searchKnowledge(q));
  });

  app.get("/knowledge/:id", async (req, res) => {
    const cap = await memory.getCapability(req.params.id);
    if (!cap) return res.status(404).json({ error: "capability not found" });
    res.json(cap);
  });

  app.get("/knowledge/recommend/:task", async (req, res) => {
    res.json(await memory.recommend(req.params.task));
  });

  // ─── Cognitive state ───
  app.get("/cognitive", async (req, res) => {
    res.json(await memory.getCognitive());
  });

  app.post("/cognitive", async (req, res) => {
    try {
      await memory.saveCognitive(req.body);
      res.json({ saved: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/cognitive/brief", async (req, res) => {
    const brief = await memory.getBootBrief();
    res.json({ brief });
  });

  // ─── Decision journal ───
  app.post("/decisions", async (req, res) => {
    try {
      await memory.logDecision(req.body);
      res.json({ logged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/decisions", async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(await memory.recentDecisions(limit));
  });
}

module.exports = { registerRoutes };
