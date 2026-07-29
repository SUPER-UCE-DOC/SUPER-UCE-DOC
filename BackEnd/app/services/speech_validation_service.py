import hashlib
import json
import logging
import re
import requests
from sqlalchemy.orm import Session
from app.config import settings
from app.services.conversation_service import conversation_service

logger = logging.getLogger("speech_validation")

class SpeechValidationService:
    def __init__(self):
        # Cache en memoria: hash_audio -> (is_valid, final_score, reason)
        self.validation_cache = {}

    def get_audio_hash(self, audio_base64: str) -> str:
        return hashlib.md5(audio_base64.encode('utf-8')).hexdigest()

    def _apply_heuristics(self, text: str):
        """
        Calcula un score de 0 a 100 basado en heurísticas.
        Retorna (score, reason, detected_issue)
        """
        score = 100
        text_lower = text.lower()
        words = text.split()
        
        # 1. Firmas exactas de alucinación de Whisper/Gemini Audio
        hallucination_signatures = [
            "me llamo maría", "mi nombre es maría", "soy maría", "tengo 35 años",
            "soy de madrid", "soy de españa", "subtítulos por", "transcripción de",
            "silencio"
        ]
        for sig in hallucination_signatures:
            if sig in text_lower:
                return (0, f"Firma de alucinación detectada: '{sig}'", "hallucination_signature")

        # 2. Longitud (menos de 2 palabras puede ser sospechoso pero no automáticamente descartado)
        if len(words) < 2:
            score -= 30
            
        # 3. Repeticiones (ej. "hola hola hola hola")
        if len(words) >= 4 and len(set(words)) == 1:
            return (10, "Repetición anómala de palabras", "repetition_anomaly")

        return (score, "Heurística superada", "none")

    def _apply_llm_validation(self, transcription: str, recent_context: str) -> dict:
        """
        Utiliza un modelo ultra-rápido para validar contextualmente.
        """
        if not settings.OPENROUTER_API_KEY:
            return {"is_valid": True, "confidence": 1.0, "reason": "No API key for LLM validation", "detected_issue": "none"}

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "SUPER-UCE DOC"
        }

        # Modelo ultra rápido y barato para validación
        model_name = "google/gemini-2.5-flash-lite"
        
        system_prompt = (
            "Eres un validador estricto de Speech-to-Text. "
            "Debes analizar la transcripción y el contexto de la conversación. "
            "Si la transcripción es una alucinación (ej. inventa datos de 'María', '35 años', etc. que no vienen al caso) "
            "o no tiene ningún sentido en el contexto, devuelves is_valid=false. "
            "Si es una continuación lógica o inicio normal, devuelves is_valid=true. "
            "Responde EXACTAMENTE en formato JSON."
        )
        
        user_prompt = f"Contexto Reciente:\n{recent_context}\n\nTranscripción a validar:\n{transcription}"

        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
            "max_tokens": 150
        }

        try:
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=10)
            if res.status_code == 200:
                response_text = res.json()["choices"][0]["message"]["content"].strip()
                # Limpiar backticks si los hay
                response_text = re.sub(r"^```json|```$", "", response_text, flags=re.IGNORECASE).strip()
                result = json.loads(response_text)
                return result
        except Exception as e:
            logger.error(f"Error en validación semántica (LLM): {e}")
        
        # En caso de fallo de red, permitimos el paso si la heurística no lo bloqueó totalmente
        return {"is_valid": True, "confidence": 0.5, "reason": "Error en LLM fallback, se permite paso", "detected_issue": "llm_error"}


    def validate(self, audio_base64: str, transcription: str, session_id: int, db: Session):
        """
        Ejecuta el pipeline de validación por etapas.
        Retorna (is_valid, debug_info_dict)
        """
        # Limpiar prefijos base64 si existen para el hash
        clean_base64 = audio_base64.split(",", 1)[1] if "," in audio_base64 else audio_base64
        audio_hash = self.get_audio_hash(clean_base64)

        if audio_hash in self.validation_cache:
            logger.info(f"[Speech Validation] Caché HIT para audio {audio_hash[:8]}...")
            return self.validation_cache[audio_hash]

        # Etapa 2: Heurísticas
        score, h_reason, h_issue = self._apply_heuristics(transcription)
        
        debug_info = {
            "audio_hash": audio_hash,
            "transcription": transcription,
            "heuristic_score": score,
            "heuristic_reason": h_reason,
            "llm_used": False,
            "final_score": score,
            "is_valid": True,
            "reason": "OK"
        }

        if score <= 0:
            debug_info["is_valid"] = False
            debug_info["reason"] = h_reason
            debug_info["final_score"] = 0
            self.validation_cache[audio_hash] = (False, debug_info)
            return False, debug_info

        # Etapa 3: Validación LLM
        if score < 100 or len(transcription.split()) > 5:
            debug_info["llm_used"] = True
            
            # Obtener contexto
            recent_context = "Sin contexto previo (nueva sesión)."
            if session_id and db:
                recent_msgs = conversation_service.get_recent_messages(db, session_id, limit=4)
                if recent_msgs:
                    recent_context = "\n".join([f"[{m.role.upper()}]: {m.content}" for m in recent_msgs])

            llm_result = self._apply_llm_validation(transcription, recent_context)
            debug_info["llm_result"] = llm_result
            
            # Ajustar score final
            is_valid_llm = llm_result.get("is_valid", True)
            if not is_valid_llm:
                score -= 60
                
            debug_info["final_score"] = score
            
            if score < 50:
                debug_info["is_valid"] = False
                debug_info["reason"] = llm_result.get("reason", "Rechazado por LLM semántico")
                self.validation_cache[audio_hash] = (False, debug_info)
                return False, debug_info

        # Todo OK
        self.validation_cache[audio_hash] = (True, debug_info)
        return True, debug_info

speech_validation_service = SpeechValidationService()
