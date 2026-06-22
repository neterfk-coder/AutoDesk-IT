import os
import hmac
import logging
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="ResolveAI — IT Support Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UIPATH_WEBHOOK_SECRET = os.getenv("UIPATH_WEBHOOK_SECRET", "secret")
FIREBASE_URL          = os.getenv(
    "FIREBASE_URL",
    "https://autodesk-it-default-rtdb.firebaseio.com"
)


# ── Normalize ticket ──────────────────────────────────────────────────────────
def normalize_ticket(source: str, raw: dict) -> dict:
    if source == "servicenow":
        return {
            "id":          raw.get("sys_id", f"SN-{int(datetime.utcnow().timestamp())}"),
            "source":      "servicenow",
            "title":       raw.get("short_description", "Sin título"),
            "description": raw.get("description", ""),
            "priority":    raw.get("priority", "3"),
            "user_email":  raw.get("caller_email", ""),
            "created_at":  datetime.utcnow().isoformat(),
            "raw":         raw,
        }
    elif source == "gmail":
        return {
            "id":          raw.get("message_id", f"GM-{int(datetime.utcnow().timestamp())}"),
            "source":      "gmail",
            "title":       raw.get("subject", "Sin asunto"),
            "description": raw.get("body", ""),
            "priority":    "3",
            "user_email":  raw.get("from_email", ""),
            "created_at":  datetime.utcnow().isoformat(),
            "raw":         raw,
        }
    else:
        raise ValueError(f"Fuente desconocida: {source}")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":    "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service":   "ResolveAI IT Support Agent"
    }


# ── Webhooks ──────────────────────────────────────────────────────────────────
@app.post("/webhook/servicenow")
async def receive_servicenow(
    request: Request,
    background_tasks: BackgroundTasks
):
    signature = request.headers.get("X-ServiceNow-Secret", "")
    if UIPATH_WEBHOOK_SECRET and not hmac.compare_digest(
        signature, UIPATH_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Firma inválida")

    body   = await request.json()
    ticket = normalize_ticket("servicenow", body)
    logger.info(f"Ticket ServiceNow recibido: {ticket['id']}")
    background_tasks.add_task(process_ticket, ticket)
    return JSONResponse({"status": "accepted", "ticket_id": ticket["id"]})


@app.post("/webhook/gmail")
async def receive_gmail(
    request: Request,
    background_tasks: BackgroundTasks
):
    import base64
    import json as _json

    body = await request.json()
    try:
        data       = base64.b64decode(body["message"]["data"]).decode("utf-8")
        email_data = _json.loads(data)
    except Exception as e:
        logger.error(f"Error decodificando Gmail: {e}")
        raise HTTPException(status_code=400, detail="Payload inválido")

    ticket = normalize_ticket("gmail", email_data)
    logger.info(f"Ticket Gmail recibido: {ticket['id']}")
    background_tasks.add_task(process_ticket, ticket)
    return JSONResponse({"status": "accepted", "ticket_id": ticket["id"]})


@app.post("/webhook/manual")
async def receive_manual(
    request: Request,
    background_tasks: BackgroundTasks
):
    body   = await request.json()
    ticket = {
        "id":          f"MAN-{int(datetime.utcnow().timestamp())}",
        "source":      "manual",
        "title":       body.get("title", "Ticket manual"),
        "description": body.get("description", ""),
        "priority":    body.get("priority", "3"),
        "user_email":  body.get("user_email", ""),
        "created_at":  datetime.utcnow().isoformat(),
    }
    logger.info(f"Ticket manual recibido: {ticket['id']}")
    background_tasks.add_task(process_ticket, ticket)
    return JSONResponse({"status": "accepted", "ticket_id": ticket["id"]})


# ── Process ───────────────────────────────────────────────────────────────────
async def process_ticket(ticket: dict):
    logger.info(f"Procesando ticket {ticket['id']}")
    try:
        from server.orchestrator import process_ticket as orchestrate
        await orchestrate(ticket)
    except Exception as e:
        logger.error(f"Error en orchestrator: {e}")
        try:
            from database.firebase_client import save_ticket
            await save_ticket(ticket)
        except Exception as fe:
            logger.error(f"Error guardando en Firebase: {fe}")


# ── GET endpoints ─────────────────────────────────────────────────────────────
@app.get("/tickets")
async def get_tickets():
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FIREBASE_URL}/tickets.json",
            timeout=10
        )
        data = resp.json() or {}
    return {"tickets": list(data.values())}


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    from database.firebase_client import get_ticket_history
    return await get_ticket_history(ticket_id)


@app.get("/docs-info")
async def docs_info():
    return {
        "endpoints": [
            "GET  /health",
            "GET  /tickets",
            "GET  /tickets/{id}",
            "POST /webhook/servicenow",
            "POST /webhook/gmail",
            "POST /webhook/manual",
        ],
        "dashboard": "frontend/index.html",
        "docs":      "http://localhost:8000/docs",
    }


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.webhook_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )