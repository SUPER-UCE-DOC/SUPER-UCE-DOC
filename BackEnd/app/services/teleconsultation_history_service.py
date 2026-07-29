from sqlalchemy.orm import Session
from app.models import ClinicalHistory
from app.services.vector_index import vector_index
from app.services.openrouter_embeddings import openrouter_embeddings
import json
import logging

logger = logging.getLogger("teleconsultation_history_service")

class TeleconsultationHistoryService:
    def save_teleconsultation_summary(
        self, db: Session, patient_id: int, doctor_id: int, 
        summary: str, diagnostics: str = "", recommendations: str = "", prescriptions: str = ""
    ):
        """
        Almacena el resumen de una teleconsulta terminada en la tabla extendida 'ClinicalHistory' 
        y genera automáticamente su representación vectorial semántica.
        """
        # 1. Almacenamiento en DB SQL Extendida
        history = ClinicalHistory(
            patient_id=patient_id,
            doctor_id=doctor_id,
            summary_ia=summary,
            diagnostics=diagnostics,
            recommendations=recommendations,
            prescriptions=prescriptions,
            metadata_json=json.dumps({"source": "hybrid_memory_teleconsultation"})
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        
        # 2. Vectorización del contenido rico
        full_text = f"Motivo/Resumen: {summary}\nDiagnósticos: {diagnostics}\nRecomendaciones: {recommendations}\nRecetas: {prescriptions}"
        emb = openrouter_embeddings.get_embedding(full_text)
        
        # 3. Guardado en índice independiente
        if emb:
            vector_id = vector_index.add_record(
                embedding=emb,
                payload={
                    "type": "teleconsultation",
                    "patient_id": patient_id,
                    "doctor_id": doctor_id,
                    "history_id": history.id,
                    "content": full_text
                }
            )
            history.embedding_ref = vector_id
            db.commit()
            
        logger.info(f"Teleconsulta #{history.id} del paciente {patient_id} guardada e indexada.")
        return history
        
teleconsultation_history_service = TeleconsultationHistoryService()
