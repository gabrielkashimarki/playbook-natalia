const express = require("express");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PASSWORD_HASH = process.env.PASSWORD_HASH || "";
const RAW_PASSWORD = process.env.APP_PASSWORD || "natalia2026";

// ═══════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════
const DB_PATH = path.join(__dirname, "data", "playbook.db");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    emoji TEXT DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    label TEXT DEFAULT '',
    label_class TEXT DEFAULT 'label-abordagem',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    content TEXT DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
  );
`);

// ═══════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + SECRET).digest("hex");
}

function createToken(ip) {
  const payload = JSON.stringify({ ip, ts: Date.now() });
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${hmac}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [b64, hmac] = token.split(".");
  if (!b64 || !hmac) return false;
  try {
    const payload = Buffer.from(b64, "base64url").toString();
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (hmac !== expected) return false;
    const data = JSON.parse(payload);
    // Token valid for 30 days
    return Date.now() - data.ts < 30 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════
// EXPRESS APP
// ═══════════════════════════════════════════════════════════
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth middleware
function requireAuth(req, res, next) {
  if (verifyToken(req.cookies?.auth_token)) return next();
  if (req.headers.accept?.includes("json")) return res.status(401).json({ error: "Não autorizado" });
  res.redirect("/login");
}

// ─── LOGIN ──────────────────────────────────────────────
app.get("/login", (req, res) => {
  if (verifyToken(req.cookies?.auth_token)) return res.redirect("/");
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  const expected = PASSWORD_HASH || hashPassword(RAW_PASSWORD);
  const provided = hashPassword(password);
  if (provided === expected) {
    res.cookie("auth_token", createToken(req.ip), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return res.redirect("/");
  }
  res.redirect("/login?error=1");
});

app.get("/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.redirect("/login");
});

// ─── STATIC + BOARD ────────────────────────────────────
app.use("/public", requireAuth, express.static(path.join(__dirname, "public")));
app.get("/", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "board.html"));
});

// ═══════════════════════════════════════════════════════════
// API — COLUMNS
// ═══════════════════════════════════════════════════════════
app.get("/api/columns", requireAuth, (req, res) => {
  const cols = db.prepare("SELECT * FROM columns ORDER BY position").all();
  const cards = db.prepare("SELECT * FROM cards ORDER BY position").all();
  const result = cols.map(c => ({
    ...c,
    cards: cards.filter(card => card.column_id === c.id),
  }));
  res.json(result);
});

app.post("/api/columns", requireAuth, (req, res) => {
  const { title, emoji } = req.body;
  const maxPos = db.prepare("SELECT COALESCE(MAX(position),0) as mp FROM columns").get().mp;
  const info = db.prepare("INSERT INTO columns (title, emoji, position) VALUES (?, ?, ?)").run(title || "Nova Coluna", emoji || "📋", maxPos + 1);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/columns/:id", requireAuth, (req, res) => {
  const { title, emoji, position } = req.body;
  if (title !== undefined) db.prepare("UPDATE columns SET title=? WHERE id=?").run(title, req.params.id);
  if (emoji !== undefined) db.prepare("UPDATE columns SET emoji=? WHERE id=?").run(emoji, req.params.id);
  if (position !== undefined) db.prepare("UPDATE columns SET position=? WHERE id=?").run(position, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/columns/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM columns WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/columns/reorder", requireAuth, (req, res) => {
  const { order } = req.body; // [id, id, id...]
  const stmt = db.prepare("UPDATE columns SET position=? WHERE id=?");
  const tx = db.transaction(() => { order.forEach((id, i) => stmt.run(i, id)); });
  tx();
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// API — CARDS
// ═══════════════════════════════════════════════════════════
app.post("/api/cards", requireAuth, (req, res) => {
  const { column_id, label, label_class, title, description, content } = req.body;
  const maxPos = db.prepare("SELECT COALESCE(MAX(position),0) as mp FROM cards WHERE column_id=?").get(column_id).mp;
  const info = db.prepare(
    "INSERT INTO cards (column_id, label, label_class, title, description, content, position) VALUES (?,?,?,?,?,?,?)"
  ).run(column_id, label || "", label_class || "label-abordagem", title || "Novo Card", description || "", content || "", maxPos + 1);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/cards/:id", requireAuth, (req, res) => {
  const fields = ["column_id", "label", "label_class", "title", "description", "content", "position"];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      db.prepare(`UPDATE cards SET ${f}=? WHERE id=?`).run(req.body[f], req.params.id);
    }
  });
  res.json({ ok: true });
});

app.delete("/api/cards/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM cards WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/cards/move", requireAuth, (req, res) => {
  const { card_id, target_column_id, position } = req.body;
  db.prepare("UPDATE cards SET column_id=?, position=? WHERE id=?").run(target_column_id, position, card_id);
  // Reindex cards in target column
  const cards = db.prepare("SELECT id FROM cards WHERE column_id=? ORDER BY position, id").all(target_column_id);
  const stmt = db.prepare("UPDATE cards SET position=? WHERE id=?");
  const tx = db.transaction(() => { cards.forEach((c, i) => stmt.run(i, c.id)); });
  tx();
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n  🟢 Playbook Comercial rodando em http://localhost:${PORT}\n`);
  console.log(`  Senha padrão: ${RAW_PASSWORD}`);
  console.log(`  Para alterar, defina APP_PASSWORD no .env\n`);
});
