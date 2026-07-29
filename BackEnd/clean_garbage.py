import os
import sys

# Agregar el directorio padre al sys.path para poder importar 'app'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import PatientMemory
from app.services.vector_index import vector_index

def clean_and_resync():
    db = SessionLocal()
    
    # 1. Encontrar y borrar las alergias genéricas a "medicamento"
    bad_memories = db.query(PatientMemory).filter(
        PatientMemory.memory_type == "alergia",
        PatientMemory.value == "medicamento"
    ).all()
    
    print(f"Borrando {len(bad_memories)} alergias genéricas ('medicamento')...")
    for bm in bad_memories:
        # Borrar de SQL
        db.delete(bm)
        # Si tiene referencia vectorial, la lógica de borrado real del NPZ es compleja, 
        # así que es mejor simplemente borrar el NPZ y correr el resync_vectors.py de nuevo.
    
    db.commit()
    db.close()
    
    # 2. Borrar la caché RAG completa para reconstruirla sin la basura
    import shutil
    cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rag_documents_cache")
    if os.path.exists(cache_path):
        shutil.rmtree(cache_path)
        os.makedirs(cache_path)
        print("Caché vectorial borrada.")
        
    print("Limpieza completada.")

if __name__ == "__main__":
    clean_and_resync()
