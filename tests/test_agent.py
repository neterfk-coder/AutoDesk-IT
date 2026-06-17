import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.claude_agent import analyze_with_claude

TICKETS_PRUEBA = [
    {
        "id": "TEST-001",
        "source": "servicenow",
        "title": "No puedo conectarme a la VPN desde casa",
        "description": "Error 'Authentication failed' en Cisco AnyConnect. Windows 11.",
        "priority": "2",
        "user_email": "usuario@empresa.com",
        "created_at": "2026-06-17T10:00:00",
    },
    {
        "id": "TEST-002",
        "source": "gmail",
        "title": "Pantalla azul al iniciar Windows",
        "description": "BSOD con código CRITICAL_PROCESS_DIED al arrancar. No puedo entrar al sistema.",
        "priority": "1",
        "user_email": "gerente@empresa.com",
        "created_at": "2026-06-17T10:05:00",
    },
    {
        "id": "TEST-003",
        "source": "servicenow",
        "title": "Impresora no detectada en red",
        "description": "La impresora HP LaserJet desapareció del listado. Otros usuarios tampoco la ven.",
        "priority": "3",
        "user_email": "asistente@empresa.com",
        "created_at": "2026-06-17T10:10:00",
    },
]

async def main():
    for ticket in TICKETS_PRUEBA:
        print(f"\n{'='*50}")
        print(f"Analizando: {ticket['title']}")
        print('='*50)
        result = await analyze_with_claude(ticket)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print(f"→ Escalar: {result.get('escalate')} | Severidad: {result.get('severity')}")

asyncio.run(main())