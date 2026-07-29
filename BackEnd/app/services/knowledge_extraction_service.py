import logging
import requests
import json
from app.config import settings

logger = logging.getLogger("knowledge_extraction")

class KnowledgeExtractionService:
    def __init__(self):
        # Usamos el modelo ultra-rápido para tareas de fondo
        self.model = "google/gemini-2.5-flash"
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        
    def extract_knowledge(self, user_message: str) -> list:
        """
        Analiza silenciosamente el mensaje del usuario y extrae conocimiento clínico
        estructurado para persistirlo en la memoria del paciente.
        """
        if not settings.OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY no configurada. Extracción cancelada.")
            return []
            
        prompt = (
            "Analiza el siguiente mensaje de un paciente e identifica SÓLO nuevos hechos médicos estructurados "
            "(alergias, enfermedades crónicas, síntomas persistentes, medicamentos actuales, cirugías, antecedentes o hábitos). "
            "Si no revela ningún dato clínico útil o es simple charla, devuelve un JSON vacío []. "
            "Si revela hechos, devuelve ESTRICTAMENTE un Array JSON con objetos con este formato: "
            "[{\"type\": \"alergia\", \"value\": \"penicilina\"}, {\"type\": \"enfermedad\", \"value\": \"diabetes tipo 2\"}]\n\n"
            f"Mensaje del paciente: \"{user_message}\"\n\n"
            "TU RESPUESTA DEBE SER ÚNICAMENTE UN ARRAY JSON VÁLIDO Y NADA MÁS:"
        )
        
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}]
        }
        
        try:
            resp = requests.post(self.url, headers=headers, json=payload, timeout=10)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"].strip()
            
            # Limpiar marcas Markdown de forma robusta
            import re
            content = re.sub(r'```(?:json)?', '', content, flags=re.IGNORECASE).strip()
            
            data = json.loads(content)
            if isinstance(data, list):
                logger.info(f"Extracción exitosa: se detectaron {len(data)} hechos clínicos.")
                return data
            return []
        except Exception as e:
            logger.error(f"Error parseando extracción de conocimiento (posible alucinación del JSON): {e}")
            return []

knowledge_extraction_service = KnowledgeExtractionService()
