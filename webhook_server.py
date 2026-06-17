import os
import hmac
import hashlib
import logging
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import httpx

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="IT Support Agent - Webhook Server")

UIPATH_WEBHOOK_SECRET = os.getenv("UIPATH_WEBHOOK_SECRET", "")

# ── Modelo normalizado de ticket ──────────────────────────────────────────────

def normalize_ticket(source: str, raw: dict) -> dict:
    """Convierte cualquier formato de entrada a nuestro formato interno."""
    if source == "servicenow":
        return {
            "id": raw.get("sys_id", ""),
            "source": "servicenow",
            "title": raw.get("short_description", "Sin título"),
            "description": raw.get("description", ""),
            "priority": raw.get("priority", "3"),
            "user_email": raw.get("caller_id", {}).get("email", ""),
            "created_at": datetime.utcnow().isoformat(),
            "raw": raw,
        }
    elif source == "gmail":
        return {
            "id": raw.get("message_id", ""),
            "source": "gmail",
            "title": raw.get("subject", "Sin asunto"),
            "description": raw.get("body", ""),
            "priority": "3",
            "user_email": raw.get("from_email", ""),
            "created_at": datetime.utcnow().isoformat(),
            "raw": raw,
        }
    else:
        raise ValueError(f"Fuente desconocida: {source}")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/webhook/servicenow")
async def receive_servicenow(request: Request, background_tasks: BackgroundTasks):
    """
    ServiceNow llama aquí cada vez que se crea o actualiza un ticket IT.
    Configura Business Rule en ServiceNow para POST a esta URL.
    """
    # Verificar secreto compartido en header
    signature = request.headers.get("X-ServiceNow-Secret", "")
    if not hmac.compare_digest(signature, UIPATH_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Firma inválida")

    body = await request.json()
    logger.info(f"Ticket recibido de ServiceNow: {body.get('sys_id')}")

    ticket = normalize_ticket("servicenow", body)
    background_tasks.add_task(process_ticket, ticket)

    return JSONResponse({"status": "accepted", "ticket_id": ticket["id"]})


@app.post("/webhook/gmail")
async def receive_gmail(request: Request, background_tasks: BackgroundTasks):
    """
    Recibe notificaciones push de Gmail (Google Pub/Sub).
    """
    body = await request.json()
    # Gmail envía el mensaje en base64 dentro de body["message"]["data"]
    import base64, json as _json
    try:
        data = base64.b64decode(body["message"]["data"]).decode("utf-8")
        email_data = _json.loads(data)
    except Exception as e:
        logger.error(f"Error decodificando mensaje Gmail: {e}")
        raise HTTPException(status_code=400, detail="Payload inválido")

    ticket = normalize_ticket("gmail", email_data)
    background_tasks.add_task(process_ticket, ticket)

    return JSONResponse({"status": "accepted", "ticket_id": ticket["id"]})


# ── Procesamiento background ───────────────────────────────────────────────────

async def process_ticket(ticket: dict):
    """
    Llama al agente de Claude Code (Parte 2) y luego notifica a UiPath.
    Este es el pegamento entre todas las partes.
    """
    logger.info(f"Procesando ticket {ticket['id']} de {ticket['source']}")

    try:
        # Parte 2: análisis con Claude
        analysis = await analyze_with_claude(ticket)
        ticket["claude_analysis"] = analysis

        # Parte 3: notificar a UiPath Maestro para orquestación
        await notify_uipath_maestro(ticket)

        logger.info(f"Ticket {ticket['id']} enviado a UiPath correctamente")

    except Exception as e:
        logger.error(f"Error procesando ticket {ticket['id']}: {e}")


async def analyze_with_claude(ticket: dict) -> dict:
    """Parte 2 — se implementa en claude_agent.py (próxima entrega)."""
    # Placeholder hasta la Parte 2
    return {
        "summary": "Pendiente análisis Claude",
        "category": "unknown",
        "fix_script": None,
        "escalate": False,
    }


async def notify_uipath_maestro(ticket: dict):
    """
    Envía el ticket procesado al API Workflow de UiPath Maestro.
    La URL la obtienes del Automation Cloud una vez tengas acceso.
    """
    uipath_url = os.getenv("UIPATH_MAESTRO_WEBHOOK_URL", "")
    if not uipath_url:
        logger.warning("UIPATH_MAESTRO_WEBHOOK_URL no configurado, saltando")
        return

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            uipath_url,
            json=ticket,
            headers={
                "Content-Type": "application/json",
                "X-Secret": UIPATH_WEBHOOK_SECRET,
            },
            timeout=30,
        )
        resp.raise_for_status()
        logger.info(f"UiPath respondió: {resp.status_code}")


# ── Inicio ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("webhook_server:app", host="0.0.0.0", port=8000, reload=True)