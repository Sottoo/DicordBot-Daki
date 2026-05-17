import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startBot } from "./src/bot/index.js";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Start Discord Bot if token exists
  if (process.env.DISCORD_TOKEN) {
    try {
      await startBot();
        console.log("Discord bot initialized.");
    } catch (error) {
        console.error("Failed to start Discord bot:", error);
    }
  } else {
    console.warn("DISCORD_TOKEN is not set. The bot will not start.");
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'public');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
