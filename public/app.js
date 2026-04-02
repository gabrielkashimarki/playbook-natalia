// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let columns = [];
let draggedCard = null;
let draggedCol = null;
let editMode = false;

// ═══════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════
const api = {
  async get(url) { const r = await fetch(url); return r.json(); },
  async post(url, data) { return (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json(); },
  async put(url, data) { return (await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json(); },
  async del(url) { return (await fetch(url, { method: "DELETE" })).json(); },
};

// ═══════════════════════════════════════════════════════════
// RENDER BOARD
// ═══════════════════════════════════════════════════════════
async function loadBoard() {
  columns = await api.get("/api/columns");
  renderBoard();
}

function renderBoard(filter = "") {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const q = filter.toLowerCase();

  columns.forEach(col => {
    const filtered = col.cards.filter(c =>
      !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || (c.content || "").toLowerCase().includes(q)
    );

    const colEl = document.createElement("div");
    colEl.className = "column";
    colEl.dataset.colId = col.id;

    // Header
    colEl.innerHTML = `
      <div class="col-header" draggable="true" data-col-drag="${col.id}">
        <span class="emoji">${col.emoji || "📋"}</span>
        <span class="col-title" contenteditable="false" data-col-title="${col.id}">${col.title}</span>
        <span class="count">${filtered.length}</span>
        <button class="col-menu" data-col-menu="${col.id}">⋯</button>
        <div class="dropdown" id="dropdown-${col.id}">
          <button onclick="editColumn(${col.id})">✏️ Editar coluna</button>
          <button onclick="deleteColumn(${col.id})" class="danger">🗑️ Excluir coluna</button>
        </div>
      </div>
      <div class="col-body" data-col-body="${col.id}"></div>
      <div class="col-footer">
        <button class="btn-add-card" onclick="addCard(${col.id})">+ Adicionar card</button>
      </div>
    `;

    const body = colEl.querySelector(".col-body");

    // Drop zone
    body.addEventListener("dragover", e => { e.preventDefault(); colEl.classList.add("drag-over"); });
    body.addEventListener("dragleave", () => colEl.classList.remove("drag-over"));
    body.addEventListener("drop", e => {
      e.preventDefault();
      colEl.classList.remove("drag-over");
      if (draggedCard) {
        const cardId = parseInt(draggedCard.dataset.cardId);
        const targetColId = col.id;
        const cards = body.querySelectorAll(".card");
        let position = cards.length;
        api.post("/api/cards/move", { card_id: cardId, target_column_id: targetColId, position });
        loadBoard();
      }
    });

    // Cards
    filtered.forEach(card => {
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.dataset.cardId = card.id;
      cardEl.draggable = true;
      cardEl.innerHTML = `
        ${card.label ? `<span class="card-label ${card.label_class}">${card.label}</span>` : ""}
        <div class="card-title">${card.title}</div>
        ${card.description ? `<div class="card-desc">${card.description}</div>` : ""}
      `;
      cardEl.addEventListener("click", () => openModal(card));
      cardEl.addEventListener("dragstart", e => {
        draggedCard = cardEl;
        cardEl.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      cardEl.addEventListener("dragend", () => {
        if (draggedCard) draggedCard.classList.remove("dragging");
        draggedCard = null;
      });
      body.appendChild(cardEl);
    });

    board.appendChild(colEl);
  });
}

// ═══════════════════════════════════════════════════════════
// MODAL — VIEW / EDIT CARD
// ═══════════════════════════════════════════════════════════
const LABEL_OPTIONS = [
  { value: "label-abordagem", text: "Abordagem", label: "ABORDAGEM" },
  { value: "label-followup", text: "Follow-Up", label: "FOLLOW-UP" },
  { value: "label-objecao", text: "Objeção", label: "OBJEÇÃO" },
  { value: "label-fechamento", text: "Fechamento", label: "FECHAMENTO" },
  { value: "label-antivacuo", text: "Anti-Vácuo", label: "ANTI-VÁCUO" },
  { value: "label-reativacao", text: "Reativação", label: "REATIVAÇÃO" },
  { value: "label-fluxo", text: "Fluxo", label: "FLUXO" },
];

let currentCard = null;

function openModal(card) {
  currentCard = card;
  const overlay = document.getElementById("overlay");
  const header = document.getElementById("modalHeader");
  const body = document.getElementById("modalBody");
  const footer = document.getElementById("modalFooter");

  const labelOpts = LABEL_OPTIONS.map(o =>
    `<option value="${o.value}" ${card.label_class === o.value ? "selected" : ""}>${o.text}</option>`
  ).join("");

  header.innerHTML = `
    <h2 id="editTitle" contenteditable="true">${card.title}</h2>
    <div class="meta">
      <select id="editLabelClass">${labelOpts}</select>
      <input id="editLabel" value="${card.label || ""}" placeholder="Rótulo" style="width:120px;">
      <input id="editDesc" value="${card.description || ""}" placeholder="Descrição curta" style="width:200px;">
    </div>
    <div class="edit-toggle">
      <input type="checkbox" id="editModeToggle" ${editMode ? "checked" : ""}>
      <label for="editModeToggle">Modo edição HTML</label>
    </div>
  `;

  const content = card.content || "<p>Clique em 'Modo edição HTML' para editar o conteúdo deste card.</p>";
  body.innerHTML = `<div class="content-area" id="contentArea" contenteditable="${editMode}">${content}</div>`;

  document.getElementById("editModeToggle").addEventListener("change", e => {
    editMode = e.target.checked;
    const area = document.getElementById("contentArea");
    if (editMode) {
      // Switch to raw HTML editing
      const raw = area.innerHTML;
      area.textContent = raw;
      area.contentEditable = "true";
      area.style.fontFamily = "monospace";
      area.style.fontSize = "12px";
      area.style.whiteSpace = "pre-wrap";
    } else {
      // Switch back to rich view
      const raw = area.textContent;
      area.innerHTML = raw;
      area.contentEditable = "true";
      area.style.fontFamily = "";
      area.style.fontSize = "";
      area.style.whiteSpace = "";
    }
  });

  footer.innerHTML = `
    <button class="btn btn-delete" onclick="deleteCard(${card.id})">Excluir</button>
    <div class="btn-group">
      <button class="btn btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-save" onclick="saveCard(${card.id})">Salvar</button>
    </div>
  `;

  overlay.classList.add("open");
}

async function saveCard(id) {
  const area = document.getElementById("contentArea");
  let content;
  if (editMode) {
    content = area.textContent; // raw HTML
  } else {
    content = area.innerHTML;
  }

  const labelClass = document.getElementById("editLabelClass").value;
  const labelOpt = LABEL_OPTIONS.find(o => o.value === labelClass);

  await api.put(`/api/cards/${id}`, {
    title: document.getElementById("editTitle").textContent.trim(),
    label: document.getElementById("editLabel").value.trim() || (labelOpt ? labelOpt.label : ""),
    label_class: labelClass,
    description: document.getElementById("editDesc").value.trim(),
    content: content,
  });
  closeModal();
  loadBoard();
}

async function deleteCard(id) {
  if (!confirm("Excluir este card permanentemente?")) return;
  await api.del(`/api/cards/${id}`);
  closeModal();
  loadBoard();
}

function closeModal() {
  document.getElementById("overlay").classList.remove("open");
  currentCard = null;
}

// ═══════════════════════════════════════════════════════════
// COLUMNS
// ═══════════════════════════════════════════════════════════
async function addColumn() {
  const title = prompt("Nome da nova coluna:");
  if (!title) return;
  const emoji = prompt("Emoji (ex: 📋, 🔛, 🚫):", "📋") || "📋";
  await api.post("/api/columns", { title, emoji });
  loadBoard();
}

function editColumn(id) {
  closeDropdowns();
  const col = columns.find(c => c.id === id);
  const title = prompt("Nome da coluna:", col.title);
  if (title === null) return;
  const emoji = prompt("Emoji:", col.emoji) || col.emoji;
  api.put(`/api/columns/${id}`, { title, emoji }).then(() => loadBoard());
}

async function deleteColumn(id) {
  closeDropdowns();
  const col = columns.find(c => c.id === id);
  if (!confirm(`Excluir a coluna "${col.title}" e TODOS os cards dentro dela?`)) return;
  await api.del(`/api/columns/${id}`);
  loadBoard();
}

// ═══════════════════════════════════════════════════════════
// CARDS — ADD
// ═══════════════════════════════════════════════════════════
async function addCard(columnId) {
  const title = prompt("Título do card:");
  if (!title) return;
  await api.post("/api/cards", {
    column_id: columnId,
    title,
    label: "NOVO",
    label_class: "label-abordagem",
    description: "",
    content: "<h3>Objetivo</h3><p>Descreva o objetivo aqui.</p><h3>Mensagem modelo</h3><div class='msg-box good'>Escreva a mensagem aqui.</div>",
  });
  loadBoard();
}

// ═══════════════════════════════════════════════════════════
// DROPDOWN MENUS
// ═══════════════════════════════════════════════════════════
function closeDropdowns() {
  document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("open"));
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-col-menu]");
  if (btn) {
    e.stopPropagation();
    closeDropdowns();
    const dd = document.getElementById(`dropdown-${btn.dataset.colMenu}`);
    dd.classList.toggle("open");
    return;
  }
  closeDropdowns();
});

// ═══════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════
document.getElementById("btnAddCol").addEventListener("click", addColumn);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("overlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
document.getElementById("searchInput").addEventListener("input", e => renderBoard(e.target.value));

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
loadBoard();
