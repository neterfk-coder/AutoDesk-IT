// ── Configuración Supabase ─────────────────────────────────────────────────────
// Reemplaza con tus valores reales del .env
const SUPABASE_URL = "https://xxxxxxxxxxx.supabase.co";
const SUPABASE_ANON = "eyJhbGc...";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Estado local ──────────────────────────────────────────────────────────────
let tickets = [];
let activeFilter = "all";
let activeTicket = null;

// ── Inicio ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadTickets();
  subscribeRealtime();
  setupFilters();
});

// ── Cargar tickets iniciales ──────────────────────────────────────────────────
async function loadTickets() {
  const { data, error } = await sb
    .from("tickets")
    .select(`*, analyses(*)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error cargando tickets:", error);
    return;
  }
  tickets = data || [];
  renderTickets();
  updateStats();
}

// ── Realtime: escucha cambios en Supabase ─────────────────────────────────────
function subscribeRealtime() {
  sb.channel("tickets-channel")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tickets",
      },
      async (payload) => {
        if (payload.eventType === "INSERT") {
          // Carga el ticket completo con análisis
          const { data } = await sb
            .from("tickets")
            .select(`*, analyses(*)`)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            tickets.unshift(data);
            showToast(`Nuevo ticket: ${data.title}`);
          }
        }

        if (payload.eventType === "UPDATE") {
          const idx = tickets.findIndex((t) => t.id === payload.new.id);
          if (idx !== -1) {
            tickets[idx] = { ...tickets[idx], ...payload.new };
            if (activeTicket?.id === payload.new.id) {
              renderDetail(tickets[idx]);
            }
          }
        }

        renderTickets();
        updateStats();
      },
    )
    .subscribe();

  // También escucha análisis nuevos
  sb.channel("analyses-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "analyses",
      },
      async (payload) => {
        const ticketIdx = tickets.findIndex(
          (t) => t.id === payload.new.ticket_id,
        );
        if (ticketIdx !== -1) {
          if (!tickets[ticketIdx].analyses) tickets[ticketIdx].analyses = [];
          tickets[ticketIdx].analyses.push(payload.new);
          if (activeTicket?.id === payload.new.ticket_id) {
            renderDetail(tickets[ticketIdx]);
          }
        }
      },
    )
    .subscribe();
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
        ${ticket.id} · ${ticket.source} · ${ticket.user_email}
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
          <span style="color:#64748b">Causa raíz: ${escapeHtml(analysis.root_cause || "—")}</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-label">Categoría / Severidad</div>
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
          <div class="detail-label">Fix Script</div>
          <div class="fix-script">${escapeHtml(analysis.fix_script)}</div>
          <button class="copy-btn" onclick="copyScript(\`${escapeHtml(analysis.fix_script)}\`)">
            Copiar script
          </button>
        </div>
      `
          : `
        <div class="detail-section">
          <div class="detail-label">Instrucciones manuales</div>
          <div class="detail-value">${escapeHtml(analysis.fix_instructions || "—")}</div>
        </div>
      `
      }

      ${
        analysis.escalate
          ? `
        <div class="escalate-alert">
          ⚠️ <span><strong>Requiere escalación:</strong> ${escapeHtml(analysis.escalate_reason || "")}</span>
        </div>
      `
          : ""
      }
    `
        : `
      <div class="empty-state">Analizando ticket...</div>
    `
    }
  `;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const count = (status) => tickets.filter((t) => t.status === status).length;
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
  return `<span><span class="severity-dot sev-${sev}"></span>${sev}</span>`;
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
  showToast("Script copiado al portapapeles");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}
