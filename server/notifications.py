import os
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SLACK_BOT_TOKEN  = os.getenv("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL_ID = os.getenv("SLACK_CHANNEL_ID", "")
JIRA_URL         = os.getenv("JIRA_URL", "")
JIRA_EMAIL       = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN   = os.getenv("JIRA_API_TOKEN", "")


# ── Slack ──────────────────────────────────────────────────────────────────────

async def notify_slack(ticket: dict, analysis: dict):
    if not SLACK_BOT_TOKEN:
        logger.warning("SLACK_BOT_TOKEN no configurado")
        return

    severity_emoji = {
        "low": "🟢", "medium": "🟡",
        "high": "🟠", "critical": "🔴"
    }.get(analysis.get("severity", "medium"), "⚪")

    escalate = analysis.get("escalate", False)

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{severity_emoji} Nuevo ticket IT — {analysis.get('category','').upper()}"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Ticket:*\n{ticket.get('id')}"},
                {"type": "mrkdwn", "text": f"*Fuente:*\n{ticket.get('source')}"},
                {"type": "mrkdwn", "text": f"*Severidad:*\n{analysis.get('severity')}"},
                {"type": "mrkdwn", "text": f"*Tiempo estimado:*\n{analysis.get('estimated_time_minutes')} min"},
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Resumen:*\n{analysis.get('summary')}"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Causa raíz:*\n{analysis.get('root_cause')}"
            }
        },
    ]

    if analysis.get("fix_script"):
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Fix script generado:*\n```{analysis.get('fix_script')}```"
            }
        })

    if escalate:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"⚠️ *Requiere escalación:* {analysis.get('escalate_reason')}"
            }
        })
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "✅ Aprobar fix"},
                    "style": "primary",
                    "value": f"approve_{ticket.get('id')}"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "❌ Rechazar"},
                    "style": "danger",
                    "value": f"reject_{ticket.get('id')}"
                }
            ]
        })

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
                json={
                    "channel": SLACK_CHANNEL_ID,
                    "blocks": blocks,
                    "text": f"Nuevo ticket: {ticket.get('title')}"
                },
                timeout=10,
            )
            data = resp.json()
            if not data.get("ok"):
                logger.error(f"Slack error: {data.get('error')}")
            else:
                logger.info(f"Notificación Slack enviada para ticket {ticket.get('id')}")
    except Exception as e:
        logger.error(f"Error enviando a Slack: {e}")


async def notify_slack_resolved(ticket: dict, analysis: dict):
    if not SLACK_BOT_TOKEN:
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
                json={
                    "channel": SLACK_CHANNEL_ID,
                    "text": f"✅ Ticket {ticket.get('id')} resuelto automáticamente en {analysis.get('estimated_time_minutes')} min."
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"Error notificando resolución a Slack: {e}")


# ── Jira ───────────────────────────────────────────────────────────────────────

async def create_jira_issue(ticket: dict, analysis: dict):
    if not JIRA_URL or not JIRA_EMAIL or not JIRA_API_TOKEN:
        logger.warning("Credenciales Jira no configuradas")
        return None

    import base64
    credentials = base64.b64encode(
        f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode()
    ).decode()

    priority_map = {
        "low": "Low", "medium": "Medium",
        "high": "High", "critical": "Highest"
    }

    payload = {
        "fields": {
            "project":     {"key": "IT"},
            "summary":     f"[IT-Agent] {ticket.get('title')}",
            "description": {
                "type": "doc",
                "version": 1,
                "content": [{
                    "type": "paragraph",
                    "content": [{
                        "type": "text",
                        "text": (
                            f"Ticket ID: {ticket.get('id')}\n"
                            f"Fuente: {ticket.get('source')}\n"
                            f"Usuario: {ticket.get('user_email')}\n\n"
                            f"Descripción:\n{ticket.get('description')}\n\n"
                            f"Análisis IA:\n{analysis.get('summary')}\n\n"
                            f"Causa raíz: {analysis.get('root_cause')}\n\n"
                            f"Fix script:\n{analysis.get('fix_script') or 'N/A'}"
                        )
                    }]
                }]
            },
            "issuetype": {"name": "Bug"},
            "priority":  {"name": priority_map.get(analysis.get("severity", "medium"), "Medium")},
            "labels":    ["it-support-agent", analysis.get("category", "other")],
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{JIRA_URL}/rest/api/3/issue",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            issue = resp.json()
            logger.info(f"Issue Jira creado: {issue.get('key')}")
            return issue.get("key")
    except Exception as e:
        logger.error(f"Error creando issue en Jira: {e}")
        return None