let chatHistory = [];
let settings = { model: 'gpt-4o-mini', token: '', permanentContext: '' };

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    if (s.model) settings.model = s.model;
    if (s.permanentContext) settings.permanentContext = s.permanentContext;
    if (s.hasToken) document.getElementById('openaiToken').placeholder = '••••••••• (configurado)';
    document.getElementById('aiModel').value = settings.model;
    document.getElementById('permanentContext').value = settings.permanentContext;
  } catch (e) { console.error('Settings load error:', e); }
}

// ═══════════════════════════════════════════════
// SHORTCUTS
// ═══════════════════════════════════════════════
const SHORTCUTS = {
  lead_novo: "Um lead novo acabou de chegar pelo Instagram/Meta Ads. Qual a melhor abordagem inicial seguindo nosso playbook?",
  objecao: "A paciente levantou uma objeção. Me ajude a responder de forma estratégica. Qual foi a objeção?",
  followup: "Preciso fazer um follow-up com uma paciente que não respondeu. Há quanto tempo foi o último contato?",
  sumiu: "A paciente sumiu e não responde mais. Em que etapa ela parou? Me ajude a criar uma mensagem de reativação.",
  preco: "A paciente perguntou sobre preços. Como responder sem perder a venda?",
  reativacao: "Preciso reativar um lead antigo (mais de 15 dias). Me ajude com uma mensagem estratégica.",
  fechamento: "A paciente está interessada e quer agendar. Como conduzir o fechamento da consulta de diagnóstico?",
};

function sendShortcut(key) {
  const text = SHORTCUTS[key];
  document.getElementById('userInput').value = text;
  document.getElementById('userInput').focus();
}

// ═══════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  const extraCtx = document.getElementById('extraContext').value.trim();

  // Add user message to UI
  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  // Set loading
  setStatus('loading', '● Pensando...');
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  // Build messages array
  const messages = chatHistory.map(m => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        extraContext: extraCtx,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro na API');
    }

    const data = await res.json();
    const reply = data.reply || 'Sem resposta da IA.';
    addMessage('ai', reply);

  } catch (err) {
    addMessage('ai', `⚠️ **Erro:** ${err.message}\n\nVerifique se o token OpenAI está configurado nas ⚙️ Configurações.`);
  }

  sendBtn.disabled = false;
  setStatus('ready', '● Pronto');
}

// ═══════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════
function addMessage(role, content) {
  chatHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content });

  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = role === 'ai' ? '🧠' : '👤';
  const formattedContent = role === 'ai' ? formatMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      ${formattedContent}
      ${role === 'ai' ? '<div class="msg-actions"><button class="btn-copy" onclick="copyMsg(this)">📋 Copiar</button></div>' : ''}
    </div>`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatMarkdown(text) {
  // Simple markdown-like formatting
  let html = escapeHtml(text);

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  // Message boxes (custom: ✅ and ❌ prefixed lines)
  html = html.replace(/^✅ (.+)$/gm, '<div class="msg-box good">$1</div>');
  html = html.replace(/^❌ (.+)$/gm, '<div class="msg-box bad">$1</div>');
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h3>)/g, '$1');
  html = html.replace(/(<\/h3>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');

  return html;
}

function escapeHtml(text) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function copyMsg(btn) {
  const content = btn.closest('.msg-content');
  const clone = content.cloneNode(true);
  clone.querySelector('.msg-actions')?.remove();
  const text = clone.innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Copiado!';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
  });
}

function setStatus(type, text) {
  const el = document.getElementById('aiStatus');
  el.textContent = text;
  el.className = 'status' + (type === 'loading' ? ' loading' : '');
}

function clearChat() {
  if (!confirm('Limpar toda a conversa?')) return;
  chatHistory = [];
  const container = document.getElementById('chatMessages');
  container.innerHTML = `<div class="msg ai">
    <div class="msg-avatar">🧠</div>
    <div class="msg-content"><p>Conversa limpa! Como posso ajudar?</p></div>
  </div>`;
}

// ═══════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('hidden');
}

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════
function openSettings() {
  document.getElementById('settingsOverlay').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
}

async function saveSettings() {
  const token = document.getElementById('openaiToken').value.trim();
  const model = document.getElementById('aiModel').value;
  const permanentContext = document.getElementById('permanentContext').value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token || undefined, model, permanentContext }),
    });
    const data = await res.json();
    if (data.ok) {
      settings.model = model;
      settings.permanentContext = permanentContext;
      closeSettings();
      addMessage('ai', '✅ Configurações salvas com sucesso!');
    }
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

// Auto-resize textarea
document.getElementById('userInput').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

init();
