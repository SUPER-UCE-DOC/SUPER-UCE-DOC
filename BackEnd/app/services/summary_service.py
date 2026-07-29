import logging
import requests
from sqlalchemy.orm import Session
from app.models import ConversationSummary, ChatMessage
from app.config import settings

logger = logging.getLogger("summary_service")

class SummaryService:
    def __init__(self):
        # Utilizar exclusivamente modelo económico para tareas de resumen en segundo plano
        self.model = "google/gemini-2.5-flash"
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        
    def generate_summary(self, db: Session, session_id: int) -> str:
        """
        Genera o actualiza el resumen continuo de una sesión usando Gemini 2.0 Flash Lite.
        """
        existing = db.query(ConversationSummary).filter(ConversationSummary.session_id == session_id).first()
        last_id = existing.last_message_id_included if existing else 0
        
        # Recuperar solo mensajes no resumidos
        new_msgs = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id, 
            ChatMessage.id > last_id
        ).order_by(ChatMessage.id.asc()).all()
        
        if not new_msgs:
            return existing.summary_text if existing else ""
        
        conversation_text = ""
        for m in new_msgs:
            role_name = "Paciente" if m.role == "user" else "Doctor IA"
            conversation_text += f"{role_name}: {m.content}\n"
            
        previous_summary = existing.summary_text if existing else "No existe resumen previo."
        
        prompt = (
            "Actúa como un sintetizador clínico experto. Tienes un resumen previo de una conversación médica y una nueva porción de charla. "
            "Tu tarea es generar un ÚNICO resumen clínico actualizado e integrado que consolide todo. "
            "Omite saludos, cortesías y charla casual. Conserva EXCLUSIVAMENTE datos médicos, síntomas reportados, intenciones, progreso y diagnósticos.\n\n"
            f"RESUMEN PREVIO:\n{previous_summary}\n\n"
            f"NUEVOS MENSAJES:\n{conversation_text}\n\n"
            "DEVUELVE ÚNICAMENTE EL TEXTO DEL NUEVO RESUMEN (SIN ETIQUETAS, NI SALUDOS):"
        )
        
        if not settings.OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY no configurada. No se pudo resumir.")
            return previous_summary
            
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        try:
            resp = requests.post(self.url, headers=headers, json=payload, timeout=20)
            resp.raise_for_status()
            new_summary = resp.json()["choices"][0]["message"]["content"].strip()
            
            if existing:
                existing.summary_text = new_summary
                existing.last_message_id_included = new_msgs[-1].id
            else:
                new_summary_obj = ConversationSummary(
                    session_id=session_id,
                    summary_text=new_summary,
                    last_message_id_included=new_msgs[-1].id
                )
                db.add(new_summary_obj)
            db.commit()
            
            logger.info(f"Resumen de sesión {session_id} generado exitosamente (hasta msg_id {new_msgs[-1].id}).")
            return new_summary
            
        except Exception as e:
            logger.error(f"Error en summary_service: {e}")
            return previous_summary

    def get_summary(self, db: Session, session_id: int) -> str:
        s = db.query(ConversationSummary).filter(ConversationSummary.session_id == session_id).first()
        return s.summary_text if s else ""

summary_service = SummaryService()
