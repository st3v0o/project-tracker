import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// In production/Electron mode, serve the built React SPA as static files.
// STATIC_DIR is set by the Electron main process before this module loads.
const staticDir = process.env.STATIC_DIR;
if (staticDir && existsSync(staticDir)) {
  app.use(express.static(staticDir));
}

app.use("/api", router);

// SPA fallback: serve index.html for any non-/api route so client-side
// routing (wouter) works correctly when the user navigates directly to a path.
if (staticDir && existsSync(staticDir)) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
