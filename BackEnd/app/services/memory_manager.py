from sqlalchemy.orm import Session
import logging
from typing import List

from app.services.conversation_service import conversation_service
from app.services.summary_service import summary_service
from app.services.openrouter_embeddings import openrouter_embeddings
from app.services.vector_index import vector_index
from app.services.context_ranking_service import context_ranking_service
from app.services.context_builder import context_builder
from app.services.document_engine import document_engine

logger = logging.getLogger("memory_manager")

class MemoryManager:
    def build_optimal_context(
        self, db: Session, session_id: int, patient_id: int, 
        user_message: str, system_prompt: str, medical_rules: str,
        doc_ids: List[str] = None, search_query: str = None
    ) -> dict:
        """
        Orquesta el flujo completo de recuperación inteligente, evaluación (ranking),
        y construcción inmutable del contexto antes de enviarlo a Gemini 2.5 Flash.
        """
        # 1. Historial Reciente (limitado estrictamente por conversation_service)
        recent_msgs = conversation_service.get_recent_messages(db, session_id, limit=12)
        native_history = [{"role": "assistant" if m.role in ["bot", "assistant"] else "user", "content": m.content} for m in recent_msgs]
        
        # 2. Resumen de Conversación Previa
        conversation_summary = summary_service.get_summary(db, session_id)
        
        # 3. Generación de Embedding de la consulta (reformulada) para recuperación semántica
        actual_query = search_query if search_query else user_message
        query_emb = openrouter_embeddings.get_embedding(actual_query)
        candidates = []
        
        if query_emb:
            # 3.1 Recuperar Patient Memory Relevante
            mem_results = vector_index.search(query_emb, filter_dict={"type": "patient_memory", "patient_id": patient_id}, top_k=15)
            for sc, meta in mem_results:
                txt = f"- {meta.get('memory_type', '').capitalize()}: {meta.get('value', '')}"
                candidates.append({
                    "score": sc, "text": txt, "type": "memory", 
                    "tokens": conversation_service.estimate_tokens(txt)
                })
                
            # 3.2 Recuperar Resúmenes de Teleconsultas Relevantes
            tc_results = vector_index.search(query_emb, filter_dict={"type": "teleconsultation", "patient_id": patient_id}, top_k=3)
            for sc, meta in tc_results:
                txt = meta.get('content', '')
                candidates.append({
                    "score": sc, "text": txt, "type": "teleconsultation",
                    "tokens": conversation_service.estimate_tokens(txt)
                })
                
        # 4. Recuperar fragmentos de Documentos Subidos (RAG) si los hay
        if doc_ids:
            rag_results = document_engine.search_hybrid_chunks(doc_ids, actual_query, top_k=6)
            for txt, src, sc in rag_results:
                f_txt = f"{src}\n{txt}"
                candidates.append({
                    "score": float(sc) + 10.0,  # [BOOST] Prioridad máxima matemática para documentos explícitamente adjuntos
                    "text": f_txt, "type": "rag",
                    "tokens": conversation_service.estimate_tokens(f_txt)
                })
                
        # 5. Ranking Service: Podar candidatos que superen el límite de costo
        filtered_candidates = context_ranking_service.rank_and_filter(candidates)
        
        # Separar y formatear por categoría
        str_memories = "\n".join([c["text"] for c in filtered_candidates if c["type"] == "memory"])
        str_teles = "\n\n---\n\n".join([c["text"] for c in filtered_candidates if c["type"] == "teleconsultation"])
        str_rag = "\n\n".join([c["text"] for c in filtered_candidates if c["type"] == "rag"])
        
        # 6. Context Builder: Ensamblar exactamente en el orden requerido
        final_context_dict = context_builder.build_context(
            system_prompt=system_prompt,
            medical_rules=medical_rules,
            patient_memories=str_memories,
            teleconsultations=str_teles,
            conversation_summary=conversation_summary,
            recent_history=native_history,
            rag_chunks=str_rag,
            user_message=user_message
        )
        
        return final_context_dict
        
memory_manager = MemoryManager()
