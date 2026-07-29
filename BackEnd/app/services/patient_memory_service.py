from sqlalchemy.orm import Session
from app.models import PatientMemory
from app.services.vector_index import vector_index
from app.services.openrouter_embeddings import openrouter_embeddings
import logging

logger = logging.getLogger("patient_memory_service")

class PatientMemoryService:
    def upsert_memory(self, db: Session, patient_id: int, memory_type: str, value: str, origin: str, confidence: float = 1.0):
        """
        Inserta o actualiza un recuerdo estructurado, impidiendo absolutamente los duplicados.
        Mantiene consistencia entre PostgreSQL y el índice vectorial independiente.
        """
        # Verificar duplicados estructurados
        existing = db.query(PatientMemory).filter(
            PatientMemory.patient_id == patient_id,
            PatientMemory.memory_type == memory_type,
            PatientMemory.value == value
        ).first()
        
        if existing:
            existing.confidence = max(existing.confidence, confidence) # Actualiza la confianza si es mayor
            existing.origin = origin
            db.commit()
            return existing
            
        # 1. Almacenamiento en DB Estructurada (PostgreSQL/SQLite)
        new_memory = PatientMemory(
            patient_id=patient_id,
            memory_type=memory_type,
            value=value,
            confidence=confidence,
            origin=origin,
            status="activo"
        )
        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)
        
        # 2. Generación de Embeddings (Google text-embedding-004)
        emb = openrouter_embeddings.get_embedding(f"{memory_type.capitalize()}: {value}")
        
        # 3. Almacenamiento en Índice Vectorial Independiente
        if emb:
            vector_id = vector_index.add_record(
                embedding=emb,
                payload={
                    "type": "patient_memory",
                    "patient_id": patient_id,
                    "memory_id": new_memory.id,
                    "memory_type": memory_type,
                    "value": value
                }
            )
            new_memory.embedding_ref = vector_id
            db.commit()
            
        logger.info(f"[PatientMemory] Nuevo recuerdo aprendido para ID {patient_id}: {memory_type} -> {value}")
        return new_memory

    def get_all_active_memories(self, db: Session, patient_id: int):
        return db.query(PatientMemory).filter(PatientMemory.patient_id == patient_id, PatientMemory.status == "activo").all()

patient_memory_service = PatientMemoryService()
