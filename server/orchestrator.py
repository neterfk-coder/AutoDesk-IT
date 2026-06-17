import logging
from database.supabase_client import (
    save_ticket,
    update_ticket_status,
    save_analysis,
    save_action,
)
from server.claude_agent import analyze_with_claude
from server.notifications import (
    notify_slack,
    notify_slack_resolved,
    create_jira_issue,
)

logger = logging.getLogger(__name__)


async def process_ticket(ticket: dict):
    """
    Orquestador central. Flujo completo:
    1. Guardar ticket en Supabase
    2. Analizar con Groq
    3. Guardar análisis
    4. Decidir: auto-fix o escalación (human-in-the-loop)
    5. Notificar Slack + crear issue Jira si aplica
    """

    # 1 — Guardar ticket
    try:
        await save_ticket(ticket)
        await update_ticket_status(ticket["id"], "processing")
    except Exception as e:
        logger.error(f"Error guardando ticket {ticket['id']}: {e}")
        return

    # 2 — Analizar con Groq (coding agent)
    try:
        analysis = await analyze_with_claude(ticket)
        ticket["claude_analysis"] = analysis
    except Exception as e:
        logger.error(f"Error en análisis Groq: {e}")
        analysis = _fallback_analysis(ticket)
        ticket["claude_analysis"] = analysis

    # 3 — Guardar análisis en Supabase
    try:
        await save_analysis(ticket["id"], analysis)
    except Exception as e:
        logger.error(f"Error guardando análisis: {e}")

    # 4 — Decidir: escalación o resolución automática
    if analysis.get("escalate"):
        await _handle_escalation(ticket, analysis)
    else:
        await _handle_auto_fix(ticket, analysis)


async def _handle_auto_fix(ticket: dict, analysis: dict):
    """Resolución automática — el agente ejecuta el fix sin intervención humana."""
    logger.info(f"Auto-fix para ticket {ticket['id']}")

    try:
        # Notificar a Slack con el fix script
        await notify_slack(ticket, analysis)
        await save_action(
            ticket["id"], "slack_notification", "slack", "done",
            {"message": "Fix script enviado"}
        )
    except Exception as e:
        logger.error(f"Error notificando Slack: {e}")
        await save_action(ticket["id"], "slack_notification", "slack", "failed", {"error": str(e)})

    # Actualizar status a resuelto
    await update_ticket_status(ticket["id"], "resolved")
    await notify_slack_resolved(ticket, analysis)
    logger.info(f"Ticket {ticket['id']} resuelto automáticamente")


async def _handle_escalation(ticket: dict, analysis: dict):
    """
    Human-in-the-loop — el agente pausa y pide aprobación humana en Slack
    antes de ejecutar cualquier acción en tickets críticos.
    """
    logger.info(f"Escalando ticket {ticket['id']}: {analysis.get('escalate_reason')}")

    # Actualizar status a escalado
    await update_ticket_status(ticket["id"], "escalated")

    try:
        # Enviar a Slack con botones de Aprobar / Rechazar
        await notify_slack(ticket, analysis)
        await save_action(
            ticket["id"], "human_approval_requested", "slack", "pending",
            {"reason": analysis.get("escalate_reason")}
        )
    except Exception as e:
        logger.error(f"Error enviando escalación a Slack: {e}")

    try:
        # Crear issue en Jira para tracking
        jira_key = await create_jira_issue(ticket, analysis)
        if jira_key:
            await save_action(
                ticket["id"], "jira_issue_created", "jira", "done",
                {"issue_key": jira_key}
            )
    except Exception as e:
        logger.error(f"Error creando issue Jira: {e}")


def _fallback_analysis(ticket: dict) -> dict:
    return {
        "summary": ticket.get("title", "Sin título"),
        "category": "other",
        "severity": "medium",
        "root_cause": "Análisis automático falló",
        "fix_script": None,
        "fix_instructions": "Revisar manualmente",
        "escalate": True,
        "escalate_reason": "Falló el análisis automático — revisión humana requerida",
        "estimated_time_minutes": 30,
    }