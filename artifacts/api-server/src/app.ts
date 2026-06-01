import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

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

const ALLOWED_ORIGINS = [
  "https://yootechnology.com",
  "https://www.yootechnology.com",
  /^http:\/\/localhost(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = ALLOWED_ORIGINS.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      cb(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env["SESSION_SECRET"] ?? "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api", (_req, res) => {
  const now = new Date().toUTCString();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nootaayada Qaanuuni — API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 680px; margin: 0 auto; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #14532d; color: #4ade80; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-bottom: 24px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    h1 { font-size: 28px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
    .sub { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
    .card h2 { font-size: 12px; font-weight: 600; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .row span:first-child { color: #94a3b8; }
    .row span:last-child { color: #f1f5f9; font-weight: 500; }
    .endpoint { font-family: monospace; font-size: 13px; color: #7dd3fc; background: #0f172a; padding: 3px 8px; border-radius: 5px; }
    .method { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; margin-right: 8px; }
    .get  { background: #14532d; color: #4ade80; }
    .post { background: #1e3a5f; color: #60a5fa; }
    .ep-row { display: flex; align-items: center; padding: 7px 0; border-bottom: 1px solid #334155; font-size: 13px; }
    .ep-row:last-child { border-bottom: none; }
    .ep-desc { color: #94a3b8; margin-left: auto; font-size: 12px; }
    .app-link { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .app-link:hover { background: #2563eb; }
    footer { margin-top: 32px; text-align: center; color: #475569; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge"><span class="dot"></span> API Online</div>
    <h1>Nootaayada Qaanuuni</h1>
    <p class="sub">Legal Notary Management System &mdash; API Server &nbsp;&middot;&nbsp; Yoo Technology</p>

    <div class="card">
      <h2>System Status</h2>
      <div class="row"><span>Status</span><span>&#x2705; Operational</span></div>
      <div class="row"><span>Server Time</span><span>${now}</span></div>
      <div class="row"><span>Environment</span><span>Production</span></div>
      <div class="row"><span>Version</span><span>1.0.0</span></div>
    </div>

    <div class="card">
      <h2>Endpoints</h2>
      <div class="ep-row"><span class="method post">POST</span><span class="endpoint">/api/auth/login</span><span class="ep-desc">Sign in</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/auth/me</span><span class="ep-desc">Current user</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/clients</span><span class="ep-desc">List clients</span></div>
      <div class="ep-row"><span class="method post">POST</span><span class="endpoint">/api/clients</span><span class="ep-desc">Add client</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/records</span><span class="ep-desc">List notary records</span></div>
      <div class="ep-row"><span class="method post">POST</span><span class="endpoint">/api/records</span><span class="ep-desc">Create record</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/dashboard/stats</span><span class="ep-desc">Dashboard statistics</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/reports/funds</span><span class="ep-desc">Funds report</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/reports/clients</span><span class="ep-desc">Clients report</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/document-types</span><span class="ep-desc">ID document types</span></div>
      <div class="ep-row"><span class="method get">GET</span><span class="endpoint">/api/healthz</span><span class="ep-desc">Health check</span></div>
    </div>

    <div class="card">
      <h2>Application</h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">Access the full notary management application:</p>
      <a class="app-link" href="/yoo-notary/">Open Nootaayada Qaanuuni &#8594;</a>
    </div>

    <footer>&copy; 2026 Yoo Technology &middot; www.yootechnology.com</footer>
  </div>
</body>
</html>`);
});

app.use("/api", router);

export default app;
