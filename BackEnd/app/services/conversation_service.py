from sqlalchemy.orm import Session
from app.models import ChatMessage
import logging

logger = logging.getLogger("conversation_service")

class ConversationService:
    def get_recent_messages(self, db: Session, session_id: int, limit: int = 15):
        """
        Recupera estrictamente los últimos 'limit' mensajes de la conversación, ordenados cronológicamente.
        Nunca devuelve todo el historial.
        """
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.desc()).limit(limit).all()
        return list(reversed(messages)) # Devolver en orden cronológico (más antiguo a más reciente)

    def save_message(self, db: Session, session_id: int, role: str, content: str, tokens_count: int = 0, metadata_json: str = None) -> ChatMessage:
        """
        Guarda un mensaje garantizando el guardado del conteo de tokens.
        """
        msg = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            tokens_count=tokens_count,
            metadata_json=metadata_json
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
        
    def estimate_tokens(self, text: str) -> int:
        """
        Regla heurística estándar para estimar tokens: ~4 caracteres por token.
        """
        if not text:
            return 0
        return max(1, len(text) // 4)

conversation_service = ConversationService()
