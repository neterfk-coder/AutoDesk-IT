import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.notifications import notify_slack, create_jira_issue

TICKET = {
    "id": "TEST-NOTIF-001",
    "source": "servicenow",
    "title": "Prueba de notificación",
    "description": "Este es un ticket de prueba del sistema.",
    "priority": "2",
    "user_email": "test@empresa.com",
    "created_at": "2026-06-17T10:00:00",
}

ANALYSIS = {
    "summary": "Prueba del sistema de notificaciones",
    "category": "network",
    "severity": "high",
    "root_cause": "Prueba manual",
    "fix_script": "ipconfig /flushdns",
    "fix_instructions": "Ejecutar el script adjunto",
    "escalate": True,
    "escalate_reason": "Prueba de botones human-in-the-loop",
    "estimated_time_minutes": 5,
}

async def main():
    print("Probando Slack...")
    await notify_slack(TICKET, ANALYSIS)
    print("✓ Slack enviado — revisa tu canal")

    print("\nProbando Jira...")
    key = await create_jira_issue(TICKET, ANALYSIS)
    if key:
        print(f"✓ Issue Jira creado: {key}")
    else:
        print("✗ Jira falló — revisa credenciales en .env")

asyncio.run(main())