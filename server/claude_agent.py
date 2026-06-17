import os
import json
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# ── Prompt del sistema ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres un agente experto en soporte IT empresarial.
Tu trabajo es analizar tickets de soporte y generar soluciones concretas.

Cuando recibas un ticket SIEMPRE responde en formato JSON con esta estructura exacta:
{
  "summary": "resumen del problema en 1 línea",
  "category": "hardware|software|network|access|other",
  "severity": "low|medium|high|critical",
  "root_cause": "causa raíz probable",
  "fix_script": "script bash o powershell para resolver el problema, o null si no aplica",
  "fix_instructions": "pasos manuales si no hay script automatizable",
  "escalate": true o false,
  "escalate_reason": "razón si escalate es true, sino null",
  "estimated_time_minutes": número estimado de minutos para resolver
}

Reglas:
- fix_script debe ser código ejecutable real, no pseudocódigo
- Si el problema requiere acceso físico, escalate debe ser true
- Para problemas de red, incluye comandos de diagnóstico en fix_script
- Responde SOLO el JSON, sin texto adicional ni backticks
"""

# ── Función principal ──────────────────────────────────────────────────────────

async def analyze_with_claude(ticket: dict) -> dict:
    """
    Usa Groq (Llama 3.3 70B) para analizar el ticket.
    Mantenemos el nombre analyze_with_claude para no cambiar webhook_server.py
    """
    user_message = f"""Analiza este ticket de soporte IT:

FUENTE: {ticket['source']}
TÍTULO: {ticket['title']}
DESCRIPCIÓN: {ticket['description']}
PRIORIDAD DECLARADA: {ticket['priority']}
EMAIL USUARIO: {ticket['user_email']}
FECHA: {ticket['created_at']}

Genera el análisis completo y el fix script si aplica."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )

        raw_text = response.choices[0].message.content
        analysis = json.loads(raw_text)

        logger.info(
            f"Groq analizó ticket {ticket['id']}: "
            f"category={analysis.get('category')}, "
            f"severity={analysis.get('severity')}, "
            f"escalate={analysis.get('escalate')}"
        )
        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Groq no devolvió JSON válido: {e}")
        return _fallback_analysis(ticket)

    except Exception as e:
        logger.error(f"Error llamando a Groq: {e}")
        return _fallback_analysis(ticket)


def _fallback_analysis(ticket: dict) -> dict:
    """Respuesta por defecto si Groq falla."""
    return {
        "summary": ticket.get("title", "Ticket sin título"),
        "category": "other",
        "severity": "medium",
        "root_cause": "No se pudo analizar automáticamente",
        "fix_script": None,
        "fix_instructions": "Revisar manualmente",
        "escalate": True,
        "escalate_reason": "Análisis automático falló — requiere revisión humana",
        "estimated_time_minutes": 30,
    }