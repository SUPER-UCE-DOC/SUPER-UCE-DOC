import os
import sys

# Agregar el directorio padre al sys.path para poder importar 'app'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import PatientMemory, ClinicalHistory
from app.services.vector_index import vector_index
from app.services.openrouter_embeddings import openrouter_embeddings

def resync_all():
    db = SessionLocal()
    
    # 1. Resincronizar PatientMemory
    memories = db.query(PatientMemory).filter(PatientMemory.status == "activo").all()
    print(f"Encontradas {len(memories)} memorias de pacientes para resincronizar.")
    
    for mem in memories:
        print(f"Resincronizando: {mem.memory_type} -> {mem.value}")
        emb = openrouter_embeddings.get_embedding(f"{mem.memory_type.capitalize()}: {mem.value}")
        if emb:
            vector_id = vector_index.add_record(
                embedding=emb,
                payload={
                    "type": "patient_memory",
                    "patient_id": mem.patient_id,
                    "memory_id": mem.id,
                    "memory_type": mem.memory_type,
                    "value": mem.value
                }
            )
            mem.embedding_ref = vector_id
    
    # 2. Resincronizar ClinicalHistory (Teleconsultas)
    histories = db.query(ClinicalHistory).all()
    print(f"Encontrados {len(histories)} historiales clínicos para resincronizar.")
    
    for hist in histories:
        print(f"Resincronizando teleconsulta ID {hist.id}")
        full_text = f"Motivo/Resumen: {hist.summary_ia}\nDiagnósticos: {hist.diagnostics}\nRecomendaciones: {hist.recommendations}\nRecetas: {hist.prescriptions}"
        emb = openrouter_embeddings.get_embedding(full_text)
        if emb:
            vector_id = vector_index.add_record(
                embedding=emb,
                payload={
                    "type": "teleconsultation",
                    "patient_id": hist.patient_id,
                    "history_id": hist.id,
                    "content": full_text
                }
            )
            hist.embedding_ref = vector_id
            
    db.commit()
    db.close()
    
    print("Sincronización completada con éxito.")

if __name__ == "__main__":
    resync_all()
