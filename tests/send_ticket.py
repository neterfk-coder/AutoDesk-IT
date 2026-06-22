import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.firebase_client import save_ticket, save_analysis
from server.claude_agent import analyze_with_claude

async def main():
    ticket = {
        "id":          "TICKET-" + str(int(__import__('time').time())),
        "source":      "servicenow",
        "title":       "Mi computadora no enciende",
        "description": "Al presionar el botón de encendido no pasa nada. La luz del cargador está verde.",
        "priority":    "2",
        "user_email":  "empleado@empresa.com",
        "created_at":  __import__('datetime').datetime.utcnow().isoformat(),
    }

    print(f"Enviando ticket: {ticket['id']}")
    print(f"Título: {ticket['title']}\n")

    # Guardar en Firebase
    await save_ticket(ticket)
    print("✓ Ticket guardado en Firebase")
    print("→ Míralo aparecer en el dashboard ahora mismo\n")

    # Analizar con Groq
    print("Analizando con Groq IA...")
    analysis = await analyze_with_claude(ticket)
    print(f"✓ Análisis completado")
    print(f"  Severidad: {analysis.get('severity')}")
    print(f"  Categoría: {analysis.get('category')}")
    print(f"  Escalar:   {analysis.get('escalate')}")

    # Guardar análisis
    await save_analysis(ticket["id"], analysis)
    print("\n✓ Análisis guardado en Firebase")
    print("→ Haz click en el ticket en el dashboard para ver el análisis completo")

asyncio.run(main())