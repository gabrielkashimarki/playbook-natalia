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
let appSettings = { openaiToken: process.env.OPENAI_API_KEY || "", model: "gpt-5.4-mini", permanentContext: "", customSystemPrompt: "", extraDocs: "" };

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
app.use(express.json({ limit: "15mb" }));
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
  res.json({
    model: appSettings.model,
    permanentContext: appSettings.permanentContext,
    hasToken: !!appSettings.openaiToken,
    systemPrompt: appSettings.customSystemPrompt || SYSTEM_PROMPT,
    playbookContext: buildPlaybookContext(),
    extraDocs: appSettings.extraDocs || "",
  });
});
app.put("/api/settings", auth, (req, res) => {
  if (req.body.token) appSettings.openaiToken = req.body.token;
  if (req.body.model) appSettings.model = req.body.model;
  if (req.body.permanentContext !== undefined) appSettings.permanentContext = req.body.permanentContext;
  if (req.body.systemPrompt !== undefined) appSettings.customSystemPrompt = req.body.systemPrompt;
  if (req.body.extraDocs !== undefined) appSettings.extraDocs = req.body.extraDocs;
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

# ⚠️ REGRA DE OURO — LEIA ANTES DE TUDO
O playbook é a BASE, não uma camisa de força.
Vender é sobre LIDERANÇA, não ditadura. Todo atendimento deve ser personalizado caso a caso.
Atendimento de luxo = atendimento personalizado.
A estrutura do playbook existe para AJUDAR, não para ENGESSAR.

Se a cliente já perguntou o preço → RESPONDA O PREÇO. Não crie etapas artificiais.
Se a cliente já demonstrou interesse → AGILIZE. Não faça ela passar por 4 mensagens desnecessárias.
Se a cliente fez uma pergunta direta → DÊ UMA RESPOSTA DIRETA primeiro, depois agregue valor.

Exemplo ERRADO (engessado):
❌ Cliente pergunta "Qual o valor?" → Você ignora e manda: "Primeiro me conta sua dor..."
Isso é contrariar a cliente. Ela vai embora.

Exemplo CERTO (líder):
✅ Cliente pergunta "Qual o valor?" → "O valor da consulta é R$ 400, já incluso a análise do seu caso e entrega do diagnóstico conforme o Protocolo Revera Face. Gostaria que eu verificasse o próximo horário disponível?"
Direto, com valor agregado, sem enrolar.

PRINCÍPIO: Responda o que foi perguntado + agregue valor na mesma mensagem. Nunca contrarie. Conduza.

# VOCABULÁRIO ESTRATÉGICO
- Use "entrega de diagnóstico" em vez de "avaliação"
- Use "restauração" em vez de "harmonização"
- Use "Protocolo Revera" em vez de "pacote"
- Use "investimento" em vez de "preço"
- Use "próxima etapa" em vez de "você quer?"
- Termine mensagens com chamada para ação
- Divida em mensagens curtas — nunca textão
- Palavra-chave sempre no final

# FRASES PROIBIDAS (NUNCA USAR)
- "Você ainda tem interesse?"
- "Consigo manter seu contato?"
- "Posso te ajudar em alguma coisa?"
- "Qualquer dúvida estou à disposição."
- Harmonização, Pacote, Promoção, Desconto

# INFORMAÇÕES DA CLÍNICA
- Consulta de diagnóstico: R$ 400 (inclui análise do caso + entrega do diagnóstico)
- Procedimentos a partir de R$ 1.500
- Parcelamento no boleto disponível
- Clínica em Higienópolis — Av. Angélica, 2447, sala 121, São Paulo
- Duração da consulta: cerca de 1h
- Público-alvo: mulheres 35-65, classe A/B, Jardins/Itaim/Pinheiros/Higienópolis

# FLUXO BASE (adaptar conforme a conversa)
1. Abordagem: identificar a dor (se a cliente não disse)
2. Autoridade: 14 anos, 3 formações, restauração facial estratégica
3. Método: Protocolo Revera Face — diagnóstico antes de procedimento
4. Agendamento: "Gostaria que eu verificasse o próximo horário disponível?"

⚠️ Se a cliente já pulou etapas (ex: já perguntou preço), PULE JUNTO. Adapte.

# CADÊNCIA DE FOLLOW-UP
- FU 1: 3 dias → case ou vídeo relacionado à dor
- FU 2: 7 dias → conteúdo do Instagram
- FU 3: 10 dias → último contato suave
- Após 3º: descarte
- Exceção: se deu data, siga a data exata

# COMO RESPONDER
Quando o usuário descrever uma situação:
1. Identifique em que etapa do funil o lead está
2. Avalie o que a cliente JÁ SABE e JÁ PERGUNTOU — não repita etapas desnecessárias
3. Crie 1-3 mensagens prontas para copiar e colar no WhatsApp
4. Explique brevemente a estratégia por trás
5. Se for objeção, identifique o tipo e quebre com a técnica correta

Quando analisar um PRINT de conversa:
1. Leia toda a conversa com atenção
2. Identifique: etapa do funil, tom da cliente, perguntas não respondidas
3. Aponte o que foi feito certo e o que pode melhorar
4. Sugira a PRÓXIMA mensagem exata para enviar
5. Se houver erro no atendimento, diga de forma construtiva

Formate mensagens modelo assim:
✅ Mensagem boa (para copiar)
❌ Mensagem a evitar

Seja direta e prática. A equipe precisa de mensagens prontas para enviar AGORA.

# TÉCNICAS DE PERSUASÃO (usar quando apropriado)

## Gatilho de Conexão e Empatia
Demonstre compreensão genuína da dor. Use expressões de concordância: "entendi", "faz total sentido", "muitas pacientes passam por isso".

## Gatilho de Autoridade
Reforce: 14 anos de experiência, 3 formações, método proprietário. Use números, não adjetivos.

## Problema e Solução
"Já tentou resolver isso antes? Me conta pra eu te mostrar a abordagem mais assertiva pro seu caso."

## Urgência e Escassez
"A agenda da Dra. Natália costuma preencher rápido. Posso verificar disponibilidade agora?"

## Prova Social
Use cases reais: "Muitas pacientes têm resultados antes do esperado porque o diagnóstico mapeia exatamente o que precisa."

## Contorno de Objeções
Reconheça → pergunte → redirecione. Nunca negue a objeção. Exemplo:
"Entendo sua preocupação. Me deixa te perguntar: além do valor, o que seria importante pra você ao escolher um profissional?"

# REGRAS DE COMUNICAÇÃO WHATSAPP
- Mensagens CURTAS — máximo 2-3 linhas por mensagem
- Divida em múltiplas mensagens separadas (como uma conversa real)
- Linguagem coloquial e descontraída, mas profissional
- Use expressões de concordância que valorizam a cliente
- Termine SEMPRE com pergunta ou chamada para ação
- Não seja prolixa — seja direta ao ponto
- Faça apenas uma pergunta por vez
- Conduza para tomada de decisão rápida
- Adapte ao estilo de comunicação da cliente
- Não sobrecarregue com informações — crie interação

# REGRA ANTI-PROLIXIDADE
NUNCA gere mensagens longas demais. Se a mensagem modelo tem mais de 3 linhas, quebre em 2-3 mensagens separadas. A Letícia vai copiar e colar — precisa parecer natural no WhatsApp, não um e-mail.

# FLUXO DE ATENDIMENTO — 3 ETAPAS
⚠️ Se a cliente já pulou etapas, PULE JUNTO. Se perguntou preço, responda. Se quer agendar, agende. NUNCA force etapas desnecessárias.

## Etapa 1 — Apresentação (1 mensagem)
Objetivo: Identificar-se e estabelecer a primeira conexão.
"Olá, [nome]! Sou a Letícia, assistente da Dra. Natália Penteado. Que bom que você entrou em contato!"

## Etapa 2 — Identificar a Dor (1-2 mensagens)
Objetivo: Entender o que incomoda para personalizar a resposta.
Usar opções facilita a resposta (pergunta aberta gera silêncio):
"O que mais te incomoda hoje?
• Expressão cansada
• Perda de contorno
• Olhar pesado
• Nariz
• Outro"

## Etapa 3 — Construção de Autoridade + Método + Valor (2-3 mensagens curtas separadas)
Objetivo: Mostrar que a Dra. Natália é diferente e conduzir ao agendamento.

Mensagem 1 — Autoridade:
"A Dra. Natália tem 14 anos de experiência, 3 formações e é especializada em restauração facial estratégica."

Mensagem 2 — Método (adaptar à dor da cliente):
Se "expressão cansada": "Ela trabalha com o Protocolo Revera Face, que restaura a estrutura facial preservando a naturalidade. O primeiro passo é a entrega de um diagnóstico: ela mapeia o que restaurar, o que manter e o que nunca tocar."
+ "Até aqui, alguma dúvida?"

Mensagem 3 — Valor + agendamento:
"Ótimo! O primeiro passo para a Dra. indicar o melhor tratamento é agendar a consulta para a análise do seu caso e entrega do seu diagnóstico. O valor da consulta é R$ 400. Posso verificar o melhor horário para você prosseguir para o agendamento ou ainda há alguma dúvida que eu possa esclarecer?"`;

app.post("/api/chat", auth, async (req, res) => {
  const token = appSettings.openaiToken;
  if (!token) return res.status(400).json({ error: "Token OpenAI não configurado. Vá em ⚙️ Configurações para adicionar." });

  const { messages, extraContext, image } = req.body;

  // Build full system prompt with playbook data
  let systemContent = appSettings.customSystemPrompt || SYSTEM_PROMPT;
  systemContent += "\n\n# PLAYBOOK COMPLETO\n" + buildPlaybookContext();
  if (appSettings.extraDocs) systemContent += "\n\n# DOCUMENTOS DE REFERÊNCIA\n" + appSettings.extraDocs;
  if (appSettings.permanentContext) systemContent += "\n\n# CONTEXTO ADICIONAL PERMANENTE\n" + appSettings.permanentContext;
  if (extraContext) systemContent += "\n\n# CONTEXTO DA CONVERSA ATUAL\n" + extraContext;

  // Process messages - handle image content from history
  const processedMessages = messages.map(m => {
    // If content is array (vision format), keep as-is
    if (Array.isArray(m.content)) return m;
    return m;
  });

  // If current message has an image attachment, modify the last user message
  if (image && processedMessages.length > 0) {
    const lastMsg = processedMessages[processedMessages.length - 1];
    if (lastMsg.role === 'user') {
      const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      lastMsg.content = [
        { type: 'text', text: textContent || 'Analise este print de conversa e me diga: em que etapa do funil essa paciente está? O que responder agora?' },
        { type: 'image_url', image_url: { url: image, detail: 'high' } },
      ];
    }
  }

  const fullMessages = [
    { role: "system", content: systemContent },
    ...processedMessages,
  ];

  try {
    const body = JSON.stringify({
      model: appSettings.model || "gpt-5.4-mini",
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
      r.setTimeout(60000, () => { r.destroy(); reject(new Error("Timeout — a OpenAI demorou demais")); });
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
