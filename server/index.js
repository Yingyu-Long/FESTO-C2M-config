import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { DeviceService } from "./device.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};
async function bodyJson(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/json"))
    throw Object.assign(new Error("Expected application/json"), {
      status: 415,
    });
  let text = "";
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384)
      throw Object.assign(new Error("Request too large"), { status: 413 });
    text += chunk;
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}
export function createServer(
  device,
  {
    uiOrigin = process.env.UI_ORIGIN || "http://localhost:5173",
    dist = path.join(projectRoot, "dist"),
  } = {},
) {
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname.startsWith("/api/")) {
        if (req.method === "GET" && pathname === "/api/status")
          return send(res, 200, device.snapshot());
        if (req.method === "GET" && pathname === "/api/health")
          return send(res, 200, { ok: true });
        if (req.method !== "POST")
          return send(res, 405, {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed",
            },
          });
        const origin = req.headers.origin;
        const permitted = [
          `http://${req.headers.host}`,
          uiOrigin,
          "http://127.0.0.1:5173",
        ];
        if (
          (origin && !permitted.includes(origin)) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return send(res, 403, {
            error: { code: "ORIGIN_REJECTED", message: "Origin not allowed" },
          });
        const body = await bodyJson(req);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return send(res, 400, {
            error: { code: "VALIDATION", message: "Expected JSON object" },
          });
        let result;
        switch (pathname) {
          case "/api/connect":
            result = await device.connect(body);
            break;
          case "/api/disconnect":
            result = await device.disconnect();
            break;
          case "/api/control":
            result = await device.control(body);
            break;
          case "/api/parameters/read":
            result = await device.refreshParameters();
            break;
          case "/api/parameters":
            result = await device.applyParameters(body);
            break;
          default:
            return send(res, 404, {
              error: { code: "NOT_FOUND", message: "Unknown API endpoint" },
            });
        }
        return send(res, 200, result);
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const decoded = decodeURIComponent(pathname);
      let file = path.resolve(dist, "." + decoded);
      if (
        !file.startsWith(path.resolve(dist) + path.sep) &&
        file !== path.resolve(dist)
      ) {
        res.writeHead(403);
        return res.end();
      }
      try {
        if (!(await stat(file)).isFile()) file = path.join(dist, "index.html");
      } catch {
        if (path.extname(file)) {
          res.writeHead(404);
          return res.end();
        }
        file = path.join(dist, "index.html");
      }
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control":
          path.extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch (error) {
      if (!res.headersSent)
        send(
          res,
          error.status ||
            (["VALIDATION", "ERR_INVALID_ARG_TYPE"].includes(error.code)
              ? 400
              : 502),
          {
            error: {
              code: error.code || "REQUEST_FAILED",
              message: error.message,
            },
          },
        );
      else res.end();
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const config = await loadConfig();
  const device = new DeviceService(config);
  const server = createServer(device);
  const port = Number(process.env.API_PORT || 3001);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `FB36 backend: http://127.0.0.1:${port} | input reads ${config.mappingConfirmed ? "configured" : "not configured"} | writes ${config.writesEnabled ? "enabled" : "disabled"}`,
    ),
  );
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Stop the existing backend with Ctrl+C. npm run dev already starts the backend; use npm run dev:ui with npm run server:dev only when running them separately.`
      : error.message);
    process.exitCode = 1;
  });
  const shutdown = () => {
    device.stopPolling();
    device.client.close();
    server.close();
    server.closeAllConnections();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
