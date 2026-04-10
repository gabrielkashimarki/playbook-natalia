let chatHistory = [];
let settings = { model: 'gpt-4o-mini', token: '', permanentContext: '' };
let pendingImage = null; // base64 image data

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
    if (s.systemPrompt) document.getElementById('systemPrompt').value = s.systemPrompt;
    if (s.playbookContext) document.getElementById('playbookPreview').value = s.playbookContext;
    if (s.extraDocs) document.getElementById('extraDocs').value = s.extraDocs;
  } catch (e) { console.error('Settings load error:', e); }
}

// ═══════════════════════════════════════════════
// IMAGE HANDLING
// ═══════════════════════════════════════════════
function handlePaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      processImageFile(file);
      return;
    }
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    processImageFile(file);
  }
  event.target.value = ''; // reset
}

function processImageFile(file) {
  // Resize if too large (max 1MB for API efficiency)
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      pendingImage = canvas.toDataURL('image/jpeg', 0.85);
      showImagePreview(pendingImage);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showImagePreview(dataUrl) {
  const preview = document.getElementById('imagePreview');
  const img = document.getElementById('previewImg');
  img.src = dataUrl;
  preview.style.display = 'flex';
}

function clearImage() {
  pendingImage = null;
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('previewImg').src = '';
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
  print: "Colei um print da conversa. Analise a conversa, identifique a etapa do funil, e me diga exatamente o que responder agora. Sugira 2-3 opções de mensagem.",
  registrar_caso: "Preciso registrar um caso de atendimento no playbook. Vou descrever a situação real e como deveria ter sido a abordagem correta. Analise, corrija e me dê a versão ideal com:\n\n1. O que aconteceu (erro)\n2. Como corrigir\n3. Mensagens modelo prontas\n4. Regra de condução\n\nSituação: ",
};

function sendShortcut(key) {
  const text = SHORTCUTS[key];
  document.getElementById('userInput').value = text;
  document.getElementById('userInput').focus();
  // For print shortcut, also open file picker
  if (key === 'print') {
    document.getElementById('fileInput').click();
  }
}

// Drag & drop images anywhere in chat
document.addEventListener('DOMContentLoaded', () => {
  const chatMain = document.querySelector('.chat-main');
  if (!chatMain) return;
  chatMain.addEventListener('dragover', e => { e.preventDefault(); chatMain.classList.add('drag-active'); });
  chatMain.addEventListener('dragleave', e => { if (!chatMain.contains(e.relatedTarget)) chatMain.classList.remove('drag-active'); });
  chatMain.addEventListener('drop', e => {
    e.preventDefault();
    chatMain.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
      document.getElementById('userInput').focus();
    }
  });
});

// ═══════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  const hasImage = !!pendingImage;
  if (!text && !hasImage) return;

  const extraCtx = document.getElementById('extraContext').value.trim();
  const imageData = pendingImage;

  // Add user message to UI (with image if present)
  addMessage('user', text, imageData);
  input.value = '';
  input.style.height = 'auto';
  clearImage();

  // Set loading
  setStatus('loading', '● Pensando...');
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  // Build messages for API
  const messages = chatHistory.map(m => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        extraContext: extraCtx,
        image: imageData || undefined,
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
function addMessage(role, content, imageData) {
  // Store in history - for images, build OpenAI vision format
  if (role === 'user' && imageData) {
    const parts = [];
    if (content) parts.push({ type: 'text', text: content });
    parts.push({ type: 'image_url', image_url: { url: imageData, detail: 'high' } });
    chatHistory.push({ role: 'user', content: parts });
  } else {
    chatHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: content });
  }

  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = role === 'ai' ? '🧠' : '👤';
  const formattedContent = role === 'ai' ? formatMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');
  const imageHtml = imageData ? `<img src="${imageData}" class="msg-image" onclick="window.open(this.src)">` : '';

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      ${imageHtml}
      ${formattedContent || (imageData ? '<em>📸 Imagem enviada</em>' : '')}
      ${role === 'ai' ? `<div class="msg-actions"><button class="btn-copy" onclick="copyMsg(this)">📋 Copiar</button><button class="btn-save-playbook" onclick="saveToPlaybook(this)" title="Salvar como card no Kanban">📚 Playbook</button></div>` : ''}
    </div>`;

  // Store raw text for playbook generation
  if (role === 'ai') {
    div.dataset.rawContent = content;
  }

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
  const systemPrompt = document.getElementById('systemPrompt').value.trim();
  const extraDocs = document.getElementById('extraDocs').value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token || undefined, model, permanentContext, systemPrompt: systemPrompt || undefined, extraDocs: extraDocs || undefined }),
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

// ═══════════════════════════════════════════════
// SAVE TO PLAYBOOK
// ═══════════════════════════════════════════════
let pendingCardData = null;

async function saveToPlaybook(btn) {
  const msgDiv = btn.closest('.msg');
  const rawContent = msgDiv.dataset.rawContent;
  if (!rawContent) return alert('Sem conteúdo para salvar.');

  // Find the preceding user message for context
  let userMsg = '';
  const allMsgs = [...document.querySelectorAll('.msg')];
  const idx = allMsgs.indexOf(msgDiv);
  for (let i = idx - 1; i >= 0; i--) {
    if (allMsgs[i].classList.contains('user')) {
      const content = allMsgs[i].querySelector('.msg-content');
      const clone = content.cloneNode(true);
      clone.querySelector('.msg-actions')?.remove();
      userMsg = clone.innerText;
      break;
    }
  }

  btn.textContent = '⏳ Gerando...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/generate-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiResponse: rawContent, userMessage: userMsg }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao gerar card');
    }

    const data = await res.json();
    pendingCardData = data;

    // Populate modal
    const colSelect = document.getElementById('cardColumn');
    colSelect.innerHTML = '';
    (data.columns || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.emoji} ${c.title}`;
      if (c.id === data.column_id) opt.selected = true;
      colSelect.appendChild(opt);
    });

    document.getElementById('cardTitle').value = data.title || '';
    document.getElementById('cardDesc').value = data.description || '';
    document.getElementById('cardLabel').value = data.label || 'FLUXO';
    document.getElementById('cardContent').value = data.content || '';
    document.getElementById('cardContentPreview').innerHTML = data.content || '';

    // Open modal
    document.getElementById('cardModalOverlay').classList.add('open');

  } catch (err) {
    alert('Erro: ' + err.message);
  }

  btn.textContent = '📚 Playbook';
  btn.disabled = false;
}

// Sync preview when editing HTML
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('cardContent');
  if (textarea) {
    textarea.addEventListener('input', () => {
      document.getElementById('cardContentPreview').innerHTML = textarea.value;
    });
  }
});

function closeCardModal() {
  document.getElementById('cardModalOverlay').classList.remove('open');
  pendingCardData = null;
}

async function confirmSaveCard() {
  const btn = document.getElementById('btnSaveCard');
  btn.textContent = '⏳ Salvando...';
  btn.disabled = true;

  const columnId = +document.getElementById('cardColumn').value;
  const title = document.getElementById('cardTitle').value.trim();
  const description = document.getElementById('cardDesc').value.trim();
  const label = document.getElementById('cardLabel').value.trim();
  const content = document.getElementById('cardContent').value.trim();
  const labelClass = label === 'OBJEÇÃO' ? 'label-objecao'
    : label === 'FOLLOW-UP' ? 'label-followup'
    : label === 'FECHAMENTO' ? 'label-fechamento'
    : label === 'ANTI-VÁCUO' ? 'label-antivacuo'
    : label === 'REATIVAÇÃO' ? 'label-reativacao'
    : label === 'EXEMPLO' ? 'label-abordagem'
    : 'label-fluxo';

  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: columnId, label, label_class: labelClass, title, description, content }),
    });

    if (!res.ok) throw new Error('Erro ao salvar');
    const data = await res.json();

    closeCardModal();
    addMessage('ai', `✅ **Card salvo no Playbook!**\n\n📌 **${title}**\n📁 Salvo na coluna do Kanban (ID: ${data.id})\n\nVocê pode ver e editar o card no [Kanban](/).`);

  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }

  btn.textContent = '💾 Salvar no Kanban';
  btn.disabled = false;
}

// Auto-resize textarea
document.getElementById('userInput').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

init();
