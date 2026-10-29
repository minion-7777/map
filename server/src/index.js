const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { connect, isReady, mysqlHint } = require("./db");
const {
  searchLocations,
  syncLocations,
  createLocation,
  updateLocation,
  removeLocation,
} = require("./locations");

const app = express();
const port = Number(process.env.PORT || 4000);
const serveWeb = process.argv.includes("--web");
const webDir = path.join(__dirname, "../../client/out");

app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  })
);
app.use(express.json({ limit: "1mb" }));

function requireDb(_req, res, next) {
  if (!isReady()) {
    return res.status(503).json({ error: "mysql_unavailable", message: mysqlHint() });
  }
  return next();
}

app.get("/api/health", (_req, res) => {
  if (!isReady()) {
    return res.status(503).json({ ok: false, error: "mysql_unavailable", message: mysqlHint() });
  }
  return res.json({ ok: true, database: process.env.MYSQL_DATABASE || "dandong_map" });
});

app.get("/api/locations", requireDb, async (req, res, next) => {
  try {
    const locations = await searchLocations(req.query.q || "");
    res.json({ locations });
  } catch (error) {
    next(error);
  }
});

app.post("/api/locations", requireDb, async (req, res, next) => {
  try {
    const result = await createLocation(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.status(201).json({ location: result.value });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/locations/:id", requireDb, async (req, res, next) => {
  try {
    const result = await updateLocation(req.params.id, req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.json({ location: result.value });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/locations/:id", requireDb, async (req, res, next) => {
  try {
    const result = await removeLocation(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    return res.json({ location: result.value });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/sync", requireDb, async (req, res, next) => {
  try {
    const pushed = Array.isArray(req.body?.pushed) ? req.body.pushed : null;
    if (!pushed) return res.status(400).json({ error: "Expected a pushed array." });
    if (pushed.length > 200) return res.status(400).json({ error: "Too many changes in one sync." });

    let since = req.body?.since ?? null;
    if (since !== null) {
      if (typeof since !== "string" || Number.isNaN(Date.parse(since))) {
        return res.status(400).json({ error: "Invalid since date." });
      }
    }

    const result = await syncLocations({ since, pushed });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

if (serveWeb) {
  if (fs.existsSync(path.join(webDir, "index.html"))) {
    app.use(
      express.static(webDir, {
        setHeaders(response, filePath) {
          if (filePath.endsWith(`${path.sep}sw.js`) || filePath.endsWith(`${path.sep}index.html`)) {
            response.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (req.path.startsWith("/api")) return next();
      if (path.extname(req.path)) return next();
      return res.sendFile(path.join(webDir, "index.html"));
    });
  } else {
    console.error("No web build found. Run npm run build before npm start.");
  }
}

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  console.error(error);
  return res.status(500).json({ error: "Server error." });
});

const server = app.listen(port, () => {
  console.log(`API ready at http://localhost:${port}`);
  if (serveWeb && fs.existsSync(path.join(webDir, "index.html"))) {
    console.log(`Map ready at http://localhost:${port}`);
  } else if (!serveWeb) {
    console.log("Dev site will be at http://localhost:3000");
  }
  connect();
});

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
