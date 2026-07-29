import os
import json
import uuid
import numpy as np
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger("vector_index")

class VectorIndexService:
    def __init__(self, index_dir: str = "rag_documents_cache"):
        # Lo guardamos en el mismo directorio seguro que usa el RAG
        self.index_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", index_dir)
        os.makedirs(self.index_dir, exist_ok=True)
        self.index_file = os.path.join(self.index_dir, "hybrid_memory_index.npz")
        self.metadata_file = os.path.join(self.index_dir, "hybrid_memory_meta.json")
        
        self.vectors: np.ndarray = None
        self.metadata: List[Dict[str, Any]] = []
        self._load_index()
        
    def _load_index(self):
        try:
            if os.path.exists(self.metadata_file) and os.path.exists(self.index_file):
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                
                data = np.load(self.index_file)
                self.vectors = data["vectors"]
                logger.info(f"Índice vectorial cargado exitosamente: {len(self.metadata)} registros.")
            else:
                self.vectors = np.empty((0, 1536), dtype=np.float32) # 1536 dimensiones para text-embedding-3-small de OpenAI
                self.metadata = []
        except Exception as e:
            logger.error(f"Error cargando índice vectorial independiente: {e}")
            self.vectors = np.empty((0, 1536), dtype=np.float32)
            self.metadata = []
            
    def _save_index(self):
        try:
            with open(self.metadata_file, "w", encoding="utf-8") as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
            
            if self.vectors is not None:
                np.savez_compressed(self.index_file, vectors=self.vectors)
        except Exception as e:
            logger.error(f"Error guardando índice vectorial: {e}")

    def add_record(self, embedding: List[float], payload: Dict[str, Any]) -> str:
        record_id = str(uuid.uuid4())
        payload["_vector_id"] = record_id
        
        emb_arr = np.array([embedding], dtype=np.float32)
        
        if self.vectors is None or self.vectors.shape[0] == 0:
            self.vectors = emb_arr
        else:
            self.vectors = np.vstack([self.vectors, emb_arr])
            
        self.metadata.append(payload)
        self._save_index()
        return record_id
        
    def search(self, query_embedding: List[float], filter_dict: Dict[str, Any] = None, top_k: int = 5) -> List[Tuple[float, Dict[str, Any]]]:
        if self.vectors is None or self.vectors.shape[0] == 0:
            return []
            
        # Filtrado previo por metadata (ej. patient_id, source_type)
        valid_indices = []
        for i, meta in enumerate(self.metadata):
            if filter_dict:
                match = True
                for k, v in filter_dict.items():
                    if meta.get(k) != v:
                        match = False
                        break
                if match:
                    valid_indices.append(i)
            else:
                valid_indices.append(i)
                
        if not valid_indices:
            return []
            
        # Similitud del Coseno Vectorial (Cosine Similarity)
        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
            
        valid_vectors = self.vectors[valid_indices]
        norms = np.linalg.norm(valid_vectors, axis=1)
        
        # Evitar división por cero si hay un vector vacío
        norms[norms == 0] = 1e-9
        
        similarities = np.dot(valid_vectors, q_vec) / (norms * q_norm)
        
        results = []
        for sim, orig_idx in zip(similarities, valid_indices):
            results.append((float(sim), self.metadata[orig_idx]))
            
        # Rankear por score (mayor similitud primero)
        results.sort(key=lambda x: x[0], reverse=True)
        return results[:top_k]

vector_index = VectorIndexService()
