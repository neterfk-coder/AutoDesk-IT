import os
import logging
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

FIREBASE_URL = "https://autodesk-it-default-rtdb.firebaseio.com"


# ── Tickets ────────────────────────────────────────────────────────────────────

async def save_ticket(ticket: dict) -> dict:
    data = {
        "id":          ticket["id"],
        "source":      ticket["source"],
        "title":       ticket["title"],
        "description": ticket.get("description", ""),
        "priority":    ticket.get("priority", "3"),
        "user_email":  ticket.get("user_email", ""),
        "status":      "received",
        "created_at":  datetime.utcnow().isoformat(),
        "updated_at":  datetime.utcnow().isoformat(),
    }
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{FIREBASE_URL}/tickets/{ticket['id']}.json",
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
    logger.info(f"Ticket {ticket['id']} guardado en Firebase")
    return data


async def update_ticket_status(ticket_id: str, status: str):
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{FIREBASE_URL}/tickets/{ticket_id}.json",
            json={
                "status":     status,
                "updated_at": datetime.utcnow().isoformat(),
            },
            timeout=10,
        )
    logger.info(f"Ticket {ticket_id} → status: {status}")


# ── Análisis ───────────────────────────────────────────────────────────────────

async def save_analysis(ticket_id: str, analysis: dict) -> dict:
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
        "created_at":             datetime.utcnow().isoformat(),
    }
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{FIREBASE_URL}/analyses/{ticket_id}.json",
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
    logger.info(f"Análisis guardado para ticket {ticket_id}")
    return data


# ── Acciones ───────────────────────────────────────────────────────────────────

async def save_action(ticket_id: str, action_type: str,
                      platform: str, status: str, result: dict = {}):
    data = {
        "ticket_id":   ticket_id,
        "action_type": action_type,
        "platform":    platform,
        "status":      status,
        "result":      result,
        "created_at":  datetime.utcnow().isoformat(),
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{FIREBASE_URL}/actions.json",
            json=data,
            timeout=10,
        )


async def get_ticket_history(ticket_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        ticket_resp   = await client.get(
            f"{FIREBASE_URL}/tickets/{ticket_id}.json", timeout=10
        )
        analysis_resp = await client.get(
            f"{FIREBASE_URL}/analyses/{ticket_id}.json", timeout=10
        )
        actions_resp  = await client.get(
            f"{FIREBASE_URL}/actions.json"
            f"?orderBy=%22ticket_id%22&equalTo=%22{ticket_id}%22",
            timeout=10,
        )

    ticket   = ticket_resp.json()   or {}
    analysis = analysis_resp.json() or {}
    actions  = actions_resp.json()  or {}

    return {
        "ticket":   ticket,
        "analyses": [analysis] if analysis else [],
        "actions":  list(actions.values()) if actions else [],
    }