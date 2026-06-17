import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise ValueError("SUPABASE_URL y SUPABASE_SERVICE_KEY requeridos")
        _client = create_client(url, key)
    return _client


# ── Tickets ────────────────────────────────────────────────────────────────────

async def save_ticket(ticket: dict) -> dict:
    sb = get_supabase()
    data = {
        "id":          ticket["id"],
        "source":      ticket["source"],
        "title":       ticket["title"],
        "description": ticket.get("description", ""),
        "priority":    ticket.get("priority", "3"),
        "user_email":  ticket.get("user_email", ""),
        "status":      "received",
    }
    result = sb.table("tickets").upsert(data).execute()
    logger.info(f"Ticket {ticket['id']} guardado en Supabase")
    return result.data[0] if result.data else {}


async def update_ticket_status(ticket_id: str, status: str):
    sb = get_supabase()
    sb.table("tickets").update({
        "status":     status,
        "updated_at": "now()",
    }).eq("id", ticket_id).execute()
    logger.info(f"Ticket {ticket_id} → status: {status}")


# ── Análisis ───────────────────────────────────────────────────────────────────

async def save_analysis(ticket_id: str, analysis: dict) -> dict:
    sb = get_supabase()
    data = {
        "ticket_id":              ticket_id,
        "summary":                analysis.get("summary"),
        "category":               analysis.get("category"),
        "severity":               analysis.get("severity"),
        "root_cause":             analysis.get("root_cause"),
        "fix_script":             analysis.get("fix_script"),
        "fix_instructions":       analysis.get("fix_instructions"),
        "escalate":               analysis.get("escalate", False),
        "escalate_reason":        analysis.get("escalate_reason"),
        "estimated_time_minutes": analysis.get("estimated_time_minutes"),
    }
    result = sb.table("analyses").insert(data).execute()
    logger.info(f"Análisis guardado para ticket {ticket_id}")
    return result.data[0] if result.data else {}


# ── Acciones ───────────────────────────────────────────────────────────────────

async def save_action(ticket_id: str, action_type: str, platform: str,
                      status: str, result: dict = {}):
    sb = get_supabase()
    sb.table("actions").insert({
        "ticket_id":   ticket_id,
        "action_type": action_type,
        "platform":    platform,
        "status":      status,
        "result":      result,
    }).execute()


async def get_ticket_history(ticket_id: str) -> dict:
    sb = get_supabase()
    ticket   = sb.table("tickets").select("*").eq("id", ticket_id).execute()
    analyses = sb.table("analyses").select("*").eq("ticket_id", ticket_id).execute()
    actions  = sb.table("actions").select("*").eq("ticket_id", ticket_id).execute()
    return {
        "ticket":   ticket.data[0]   if ticket.data   else {},
        "analyses": analyses.data,
        "actions":  actions.data,
    }