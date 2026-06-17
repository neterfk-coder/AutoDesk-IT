import asyncio
from database.supabase_client import save_ticket, save_analysis, get_ticket_history

async def main():
    ticket = {
        "id": "TEST-001",
        "source": "servicenow",
        "title": "No puedo conectarme a la VPN",
        "description": "Error de autenticación en Cisco AnyConnect",
        "priority": "2",
        "user_email": "usuario@empresa.com",
        "created_at": "2026-06-17T10:00:00",
    }

    print("Guardando ticket...")
    await save_ticket(ticket)

    print("Guardando análisis...")
    await save_analysis("TEST-001", {
        "summary": "Fallo de autenticación VPN",
        "category": "network",
        "severity": "high",
        "root_cause": "Credenciales expiradas o token MFA inválido",
        "fix_script": "ipconfig /flushdns && netsh winsock reset",
        "fix_instructions": "Renovar credenciales en portal corporativo",
        "escalate": False,
        "escalate_reason": None,
        "estimated_time_minutes": 10,
    })

    print("Consultando historial...")
    history = await get_ticket_history("TEST-001")
    import json
    print(json.dumps(history, indent=2, ensure_ascii=False, default=str))

asyncio.run(main())