const express = require("express");
const { registerRoutes } = require("../../navigation/routes");

function createServer({ memory, port }) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path !== "/health") console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  registerRoutes(app, { memory });

  return {
    app,
    listen: () => new Promise(resolve => {
      const server = app.listen(port, "127.0.0.1", () => {
        console.log(`[memory-v2] listening on http://127.0.0.1:${port}`);
        resolve(server);
      });
    }),
  };
}

module.exports = { createServer };
