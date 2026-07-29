import logging
from typing import List, Dict, Any

logger = logging.getLogger("context_ranking")

class ContextRankingService:
    def __init__(self, max_tokens_limit: int = 12000):
        # Dejamos un margen de 3,000 tokens para el historial reciente, el mensaje del usuario y las reglas, 
        # garantizando no pasarnos de 15,000.
        self.max_tokens_limit = max_tokens_limit
        
    def rank_and_filter(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Toma una lista de fragmentos candidatos procedentes de diversas fuentes (RAG, 
        Teleconsultas previas, PatientMemory), los ordena por su 'score' semántico 
        y selecciona sólo los más relevantes hasta llenar el presupuesto de tokens.
        
        Estructura esperada por candidato:
        {
            "score": float,
            "text": str,
            "type": str,
            "source": str,
            "tokens": int
        }
        """
        if not candidates:
            return []
            
        # Rankear por score (mayor relevancia semántica primero)
        candidates.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        
        selected = []
        current_tokens = 0
        
        for cand in candidates:
            t_count = cand.get("tokens", len(cand.get("text", "")) // 4) # Estimación fallback
            if current_tokens + t_count <= self.max_tokens_limit:
                selected.append(cand)
                current_tokens += t_count
            else:
                logger.info(f"[Ranking] Límite de {self.max_tokens_limit} tokens alcanzado. Podando {len(candidates) - len(selected)} candidatos de baja relevancia.")
                break
                
        # Re-agrupar la lista resultante por tipos para que el Context Builder
        # pueda ordenarlos según el formato (1 al 8) solicitado por el usuario.
        return selected

context_ranking_service = ContextRankingService()
