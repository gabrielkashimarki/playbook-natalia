const express = require("express");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const RAW_PASSWORD = process.env.APP_PASSWORD || "natalia2026";

// JSON DATABASE
const DB_PATH = path.join(__dirname, "data", "playbook.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
let db = { columns: [], cards: [], nextColId: 1, nextCardId: 1 };
function loadDB() { try { if (fs.existsSync(DB_PATH)) db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch (e) { console.error("DB load error:", e.message); } }
function saveDB() { try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch (e) { console.error("DB save error:", e.message); } }
loadDB();

// AUTH
function hashPw(pw) { return crypto.createHash("sha256").update(pw + SECRET).digest("hex"); }
function createToken(ip) { const p = JSON.stringify({ ip, ts: Date.now() }); return Buffer.from(p).toString("base64url") + "." + crypto.createHmac("sha256", SECRET).update(p).digest("hex"); }
function verifyToken(t) { if (!t) return false; const [b, h] = t.split("."); if (!b || !h) return false; try { const p = Buffer.from(b, "base64url").toString(); return crypto.createHmac("sha256", SECRET).update(p).digest("hex") === h && Date.now() - JSON.parse(p).ts < 30*24*60*60*1000; } catch { return false; } }

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

function auth(req, res, next) { if (verifyToken(req.cookies?.auth_token)) return next(); req.headers.accept?.includes("json") ? res.status(401).json({ error: "Unauthorized" }) : res.redirect("/login"); }

app.get("/login", (req, res) => { verifyToken(req.cookies?.auth_token) ? res.redirect("/") : res.sendFile(path.join(__dirname, "views", "login.html")); });
app.post("/login", (req, res) => { hashPw(req.body.password) === hashPw(RAW_PASSWORD) ? (res.cookie("auth_token", createToken(req.ip), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 30*24*60*60*1000 }), res.redirect("/")) : res.redirect("/login?error=1"); });
app.get("/logout", (req, res) => { res.clearCookie("auth_token"); res.redirect("/login"); });

app.use("/public", auth, express.static(path.join(__dirname, "public")));
app.get("/", auth, (req, res) => res.sendFile(path.join(__dirname, "views", "board.html")));

// API COLUMNS
app.get("/api/columns", auth, (req, res) => {
  const cols = [...db.columns].sort((a, b) => a.position - b.position);
  res.json(cols.map(c => ({ ...c, cards: db.cards.filter(d => d.column_id === c.id).sort((a, b) => a.position - b.position) })));
});
app.post("/api/columns", auth, (req, res) => {
  const c = { id: db.nextColId++, title: req.body.title || "Nova Coluna", emoji: req.body.emoji || "", position: db.columns.reduce((m, x) => Math.max(m, x.position), -1) + 1 };
  db.columns.push(c); saveDB(); res.json({ id: c.id });
});
app.put("/api/columns/:id", auth, (req, res) => {
  const c = db.columns.find(x => x.id === +req.params.id); if (!c) return res.status(404).json({});
  ["title","emoji","position"].forEach(f => { if (req.body[f] !== undefined) c[f] = req.body[f]; }); saveDB(); res.json({ ok: true });
});
app.delete("/api/columns/:id", auth, (req, res) => {
  const id = +req.params.id; db.cards = db.cards.filter(c => c.column_id !== id); db.columns = db.columns.filter(c => c.id !== id); saveDB(); res.json({ ok: true });
});

// API CARDS
app.post("/api/cards", auth, (req, res) => {
  const { column_id, label, label_class, title, description, content } = req.body;
  const pos = db.cards.filter(c => c.column_id === column_id).reduce((m, c) => Math.max(m, c.position), -1) + 1;
  const card = { id: db.nextCardId++, column_id, position: pos, label: label||"", label_class: label_class||"label-abordagem", title: title||"Novo Card", description: description||"", content: content||"" };
  db.cards.push(card); saveDB(); res.json({ id: card.id });
});
app.put("/api/cards/:id", auth, (req, res) => {
  const c = db.cards.find(x => x.id === +req.params.id); if (!c) return res.status(404).json({});
  ["column_id","label","label_class","title","description","content","position"].forEach(f => { if (req.body[f] !== undefined) c[f] = req.body[f]; }); saveDB(); res.json({ ok: true });
});
app.delete("/api/cards/:id", auth, (req, res) => { db.cards = db.cards.filter(c => c.id !== +req.params.id); saveDB(); res.json({ ok: true }); });
app.post("/api/cards/move", auth, (req, res) => {
  const { card_id, target_column_id, position } = req.body;
  const c = db.cards.find(x => x.id === card_id); if (!c) return res.status(404).json({});
  c.column_id = target_column_id; c.position = position;
  db.cards.filter(x => x.column_id === target_column_id).sort((a, b) => a.position - b.position).forEach((x, i) => { x.position = i; });
  saveDB(); res.json({ ok: true });
});

app.listen(PORT, () => console.log("\n  Playbook rodando em http://localhost:" + PORT + "\n  Senha: " + RAW_PASSWORD + "\n"));
