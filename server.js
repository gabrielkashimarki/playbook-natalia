const express = require("express");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const https = require("https");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const RAW_PASSWORD = process.env.APP_PASSWORD || "natalia2026";

// ═══ JSON DATABASE ═══
const DB_PATH = path.join(__dirname, "data", "playbook.json");
const SETTINGS_PATH = path.join(__dirname, "data", "settings.json");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
let db = { columns: [], cards: [], nextColId: 1, nextCardId: 1 };
let appSettings = { openaiToken: process.env.OPENAI_API_KEY || "", model: "gpt-4o-mini", permanentContext: "" };

function loadDB() { try { if (fs.existsSync(DB_PATH)) db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")); } catch (e) { console.error("DB load error:", e.message); } }
function saveDB() { try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch (e) { console.error("DB save error:", e.message); } }
function loadSettings() { try { if (fs.existsSync(SETTINGS_PATH)) appSettings = { ...appSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) }; } catch (e) {} }
function saveSettings() { try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(appSettings, null, 2)); } catch (e) {} }

loadDB();
loadSettings();
if (db.columns.length === 0) { try { require("./seed"); loadDB(); console.log("Auto-seeded: " + db.columns.length + " cols, " + db.cards.length + " cards"); } catch(e) { console.error("Seed error:", e.message); } }

// ═══ AUTH ═══
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
app.get("/chat", auth, (req, res) => res.sendFile(path.join(__dirname, "views", "chat.html")));

// ═══ API COLUMNS ═══
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

// ═══ API CARDS ═══
app.post("/api/cards", auth, (req, res) => {
  const { column_id, label, label_class, title, description, content } = req.body;
  const pos = db.cards.filter(c => c.column_id === column_id).reduce((m, c) => Math.max(m, c.position), -1) + 1;
  const card = { id: db.nextCardId++, column_id, position: pos, label: label||"", label_class: label_class||"label-abordagem", title: title||"Novo Card", description: description||"", content: content||"" };
  db.cards.push(card); saveDB(); res.json({ id: card.id });
});
app.put("/api/cards/:id", auth, (req, res) => {
  const c = db.cards.find(x => x.id === +req.params.id); if (!c) return res.status(404).json({});
  if (req.body.save_version && c.content) {
    if (!c.versions) c.versions = [];
    c.versions.unshift({ title: c.title, content: c.content, date: new Date().toISOString() });
    if (c.versions.length > 20) c.versions = c.versions.slice(0, 20);
  }
  delete req.body.save_version;
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

// ═══ SETTINGS ═══
app.get("/api/settings", auth, (req, res) => {
  res.json({ model: appSettings.model, permanentContext: appSettings.permanentContext, hasToken: !!appSettings.openaiToken });
});
app.put("/api/settings", auth, (req, res) => {
  if (req.body.token) appSettings.openaiToken = req.body.token;
  if (req.body.model) appSettings.model = req.body.model;
  if (req.body.permanentContext !== undefined) appSettings.permanentContext = req.body.permanentContext;
  saveSettings();
  res.json({ ok: true });
});

// ═══ CHAT AI ═══
function buildPlaybookContext() {
  // Build a summary of all cards for the AI system prompt
  let ctx = "";
  const cols = [...db.columns].sort((a, b) => a.position - b.position);
  cols.forEach(col => {
    const cards = db.cards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position);
    ctx += `\n## ${col.emoji} ${col.title}\n`;
    cards.forEach(card => {
      // Strip HTML tags for cleaner context
      const clean = (card.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      ctx += `### ${card.title}\n${card.description}\n${clean}\n\n`;
    });
  });
  return ctx;
}

const SYSTEM_PROMPT = `Você é a assistente de vendas especializada da **Dra. Natália Penteado**, biomédica esteta com 14 anos de experiência e 3 formações acadêmicas, criadora do **Protocolo Revera Face**.

# SUA IDENTIDADE
Você é uma estrategista de vendas direta, experiente e objetiva. Seu papel é ajudar a equipe comercial (Letícia) a criar mensagens que convertem leads em consultas agendadas.

Seu tom é: **firme, empático, direto e estratégico** — como uma vendedora sênior que sabe fechar qualquer conversa.

# REGRAS ABSOLUTAS DO ATENDIMENTO
- SEMPRE texto, NUNCA áudio
- Responder leads em menos de 5 minutos
- Se quiser ligar, ligue direto — não peça permissão
- Use "entrega de diagnóstico" em vez de "avaliação"
- Use "restauração" em vez de "harmonização"
- Use "Protocolo Revera" em vez de "pacote"
- Use "investimento" em vez de "preço"
- Use "próxima etapa" em vez de "você quer?"
- Termine mensagens com chamada para ação (ex: "Qual o melhor horário?")
- Divida em mensagens curtas separadas — nunca textão
- Palavra-chave sempre no final da mensagem

# FRASES PROIBIDAS (NUNCA USAR)
- "Você ainda tem interesse?"
- "Consigo manter seu contato?"
- "Posso te ajudar em alguma coisa?"
- "Qualquer dúvida estou à disposição."
- Harmonização, Pacote, Promoção, Desconto

# INFORMAÇÕES DA CLÍNICA
- Consulta de diagnóstico: R$ 400
- Procedimentos a partir de R$ 1.500
- Parcelamento no boleto disponível
- Clínica em Higienópolis — próximo à Av. Angélica, São Paulo
- Duração da consulta: cerca de 1h
- Público-alvo: mulheres 35-65, classe A/B, Jardins/Itaim/Pinheiros/Higienópolis

# FLUXO DE ATENDIMENTO
1. Abordagem: identificar a dor com opções (expressão cansada, perda de contorno, olhar pesado, nariz)
2. Autoridade: 14 anos, 3 formações, especialista em restauração facial estratégica
3. Método: Protocolo Revera Face — diagnóstico antes de qualquer procedimento
4. Agendamento: "A próxima etapa é a entrega do seu diagnóstico. R$ 400. Qual o melhor horário?"

# CADÊNCIA DE FOLLOW-UP
- FU 1: 3 dias → case ou vídeo relacionado à dor
- FU 2: 7 dias → conteúdo do Instagram
- FU 3: 10 dias → último contato suave
- Após 3º: descarte ("Perdido: sem retorno")
- Exceção: se a paciente deu data, siga a data exata

# COMO RESPONDER
Quando o usuário descrever uma situação:
1. Identifique em que etapa do funil o lead está
2. Consulte o playbook abaixo para encontrar a melhor abordagem
3. Crie 1-3 mensagens prontas para copiar e colar no WhatsApp
4. Explique brevemente a estratégia por trás de cada mensagem
5. Se for objeção, identifique o tipo e quebre com a técnica correta

Formate suas mensagens modelo assim:
✅ Mensagem boa (para copiar)
❌ Mensagem ruim (para evitar)

Seja direta e prática. A Letícia precisa de mensagens prontas para enviar AGORA.`;

app.post("/api/chat", auth, async (req, res) => {
  const token = appSettings.openaiToken;
  if (!token) return res.status(400).json({ error: "Token OpenAI não configurado. Vá em ⚙️ Configurações para adicionar." });

  const { messages, extraContext } = req.body;

  // Build full system prompt with playbook data
  let systemContent = SYSTEM_PROMPT;
  systemContent += "\n\n# PLAYBOOK COMPLETO\n" + buildPlaybookContext();
  if (appSettings.permanentContext) systemContent += "\n\n# CONTEXTO ADICIONAL PERMANENTE\n" + appSettings.permanentContext;
  if (extraContext) systemContent += "\n\n# CONTEXTO DA CONVERSA ATUAL\n" + extraContext;

  const fullMessages = [
    { role: "system", content: systemContent },
    ...messages,
  ];

  try {
    const body = JSON.stringify({
      model: appSettings.model || "gpt-4o-mini",
      messages: fullMessages,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const result = await new Promise((resolve, reject) => {
      const opts = {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(body),
        },
      };
      const r = https.request(opts, (response) => {
        let data = "";
        response.on("data", chunk => data += chunk);
        response.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed);
          } catch (e) { reject(new Error("Resposta inválida da OpenAI")); }
        });
      });
      r.on("error", reject);
      r.setTimeout(30000, () => { r.destroy(); reject(new Error("Timeout — a OpenAI demorou demais para responder")); });
      r.write(body);
      r.end();
    });

    const reply = result.choices?.[0]?.message?.content || "Sem resposta.";
    res.json({ reply, usage: result.usage });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`\n  Playbook rodando em http://localhost:${PORT}\n`));
