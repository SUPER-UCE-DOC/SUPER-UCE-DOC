import os
import sys

# Agregar el directorio padre al sys.path para poder importar 'app'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import ChatMessage, ChatSession

def reset_chat_memory():
    db = SessionLocal()
    
    try:
        # Borramos todos los mensajes de chat para asegurar una limpieza total de la alucinación
        db.query(ChatMessage).delete()
        # Y cerramos/borramos las sesiones de chat activas
        db.query(ChatSession).delete()
        db.commit()
        print("La memoria de conversaciones (chat_messages y chat_sessions) ha sido reseteada con éxito.")
    except Exception as e:
        db.rollback()
        print(f"Error al limpiar: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_chat_memory()
