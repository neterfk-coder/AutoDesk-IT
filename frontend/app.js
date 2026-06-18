// ── Configuración Firebase Realtime Database ──────────────────────────────────
const FIREBASE_URL = "https://autodesk-it-default-rtdb.firebaseio.com";

// ── Estado local ──────────────────────────────────────────────────────────────
let tickets = [];
let activeFilter = "all";
let activeTicket = null;

// ── Inicio ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  subscribeRealtime();
  setupFilters();
});

// ── Realtime: escucha cambios en Firebase ─────────────────────────────────────
function subscribeRealtime() {
  // Escuchar tickets en tiempo real con SSE
  const ticketsUrl = `${FIREBASE_URL}/tickets.json`;

  // Carga inicial
  loadAllTickets();

  // Polling cada 3 segundos para tiempo real
  // (Firebase Realtime Database REST no soporta SSE en modo prueba sin auth)
  setInterval(loadAllTickets, 3000);
}

async function loadAllTickets() {
  try {
    const [ticketsResp, analysesResp] = await Promise.all([
      fetch(`${FIREBASE_URL}/tickets.json`),
      fetch(`${FIREBASE_URL}/analyses.json`),
    ]);

    const ticketsData = (await ticketsResp.json()) || {};
    const analysesData = (await analysesResp.json()) || {};

    const prevCount = tickets.length;

    // Combinar tickets con sus análisis
    tickets = Object.values(ticketsData)
      .map((t) => ({
        ...t,
        analyses: analysesData[t.id] ? [analysesData[t.id]] : [],
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Mostrar toast si llegó ticket nuevo
    if (prevCount > 0 && tickets.length > prevCount) {
      showToast(`Nuevo ticket: ${tickets[0].title}`);
    }

    renderTickets();
    updateStats();

    // Actualizar detalle si hay uno activo
    if (activeTicket) {
      const updated = tickets.find((t) => t.id === activeTicket.id);
      if (updated) renderDetail(updated);
    }
  } catch (e) {
    console.error("Error cargando tickets:", e);
  }
}

// ── Renderizar lista de tickets ───────────────────────────────────────────────
function renderTickets() {
  const list = document.getElementById("tickets-list");
  const filtered =
    activeFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === activeFilter);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">Sin tickets para mostrar</div>';
    return;
  }

  list.innerHTML = filtered
    .map(
      (t) => `
    <div class="ticket-card ${activeTicket?.id === t.id ? "active" : ""}"
         onclick="selectTicket('${t.id}')">
      <div class="ticket-card-header">
        <span class="ticket-title">${escapeHtml(t.title)}</span>
        <span class="badge badge-${t.status}">${statusLabel(t.status)}</span>
      </div>
      <div class="ticket-meta">
        <span>${sourceIcon(t.source)} ${t.source}</span>
        ${severityDot(t)}
        <span>${timeAgo(t.created_at)}</span>
      </div>
    </div>
  `,
    )
    .join("");
}

// ── Seleccionar ticket ────────────────────────────────────────────────────────
function selectTicket(id) {
  activeTicket = tickets.find((t) => t.id === id);
  renderTickets();
  renderDetail(activeTicket);
}

// ── Renderizar detalle ────────────────────────────────────────────────────────
function renderDetail(ticket) {
  if (!ticket) return;
  const analysis = ticket.analyses?.[0];
  const detail = document.getElementById("ticket-detail");

  detail.innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Ticket</div>
      <div class="detail-value" style="font-size:15px;font-weight:600">
        ${escapeHtml(ticket.title)}
      </div>
      <div style="color:#64748b;font-size:12px;margin-top:4px">
        ${ticket.id} · ${ticket.source} · ${ticket.user_email || "—"}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Descripción</div>
      <div class="detail-value">${escapeHtml(ticket.description || "—")}</div>
    </div>

    ${
      analysis
        ? `
      <div class="detail-section">
        <div class="detail-label">Análisis IA</div>
        <div class="detail-value">
          <strong>${escapeHtml(analysis.summary)}</strong><br>
          <span style="color:#64748b">
            Causa raíz: ${escapeHtml(analysis.root_cause || "—")}
          </span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-label">Categoría / Severidad / Tiempo</div>
        <div class="actions-row">
          <span class="action-chip">${analysis.category}</span>
          <span class="action-chip">${analysis.severity}</span>
          <span class="action-chip">~${analysis.estimated_time_minutes} min</span>
        </div>
      </div>

      ${
        analysis.fix_script
          ? `
        <div class="detail-section">
          <div class="detail-label">Fix Script generado por IA</div>
          <div class="fix-script">${escapeHtml(analysis.fix_script)}</div>
          <button class="copy-btn"
            onclick="copyScript(\`${escapeHtml(analysis.fix_script)}\`)">
            Copiar script
          </button>
        </div>
      `
          : `
        <div class="detail-section">
          <div class="detail-label">Instrucciones</div>
          <div class="detail-value">
            ${escapeHtml(analysis.fix_instructions || "—")}
          </div>
        </div>
      `
      }

      ${
        analysis.escalate
          ? `
        <div class="escalate-alert">
          ⚠️ <span>
            <strong>Requiere escalación:</strong>
            ${escapeHtml(analysis.escalate_reason || "")}
          </span>
        </div>
      `
          : ""
      }
    `
        : `
      <div class="empty-state">⏳ Analizando ticket con IA...</div>
    `
    }
  `;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const count = (s) => tickets.filter((t) => t.status === s).length;
  document.getElementById("count-received").textContent = count("received");
  document.getElementById("count-processing").textContent = count("processing");
  document.getElementById("count-resolved").textContent = count("resolved");
  document.getElementById("count-escalated").textContent = count("escalated");
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderTickets();
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(s) {
  return (
    {
      received: "Recibido",
      processing: "Procesando",
      resolved: "Resuelto",
      escalated: "Escalado",
    }[s] || s
  );
}

function sourceIcon(s) {
  return { servicenow: "🎫", gmail: "📧", manual: "✏️" }[s] || "📋";
}

function severityDot(ticket) {
  const sev = ticket.analyses?.[0]?.severity;
  if (!sev) return "";
  return `<span>
    <span class="severity-dot sev-${sev}"></span>${sev}
  </span>`;
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyScript(text) {
  navigator.clipboard.writeText(text);
  showToast("Script copiado al portapapeles ✓");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}
