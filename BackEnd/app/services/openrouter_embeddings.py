import logging
import requests
from typing import List, Optional
from app.config import settings

logger = logging.getLogger("openrouter_embeddings")

class OpenRouterEmbeddingsService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.model_name = "openai/text-embedding-3-small"
        self.base_url = "https://openrouter.ai/api/v1/embeddings"
        
    def get_embedding(self, text: str) -> List[float]:
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY no configurada. Generando embedding nulo por defecto.")
            return [0.0] * 1536
            
        payload = {
            "model": self.model_name,
            "input": text
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(self.base_url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            if "data" in data and len(data["data"]) > 0 and "embedding" in data["data"][0]:
                return data["data"][0]["embedding"]
            else:
                logger.error(f"Estructura inesperada en respuesta de embedding: {data}")
                return [0.0] * 1536
        except Exception as e:
            logger.error(f"Error generando embedding con {self.model_name}: {e}")
            return [0.0] * 1536
            
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not self.api_key or not texts:
            return [[0.0] * 1536 for _ in texts]
        
        all_embeddings = []
        batch_size = 100  # Límite seguro para no saturar el payload de OpenRouter/OpenAI
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            payload = {
                "model": self.model_name,
                "input": batch_texts
            }
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            try:
                response = requests.post(self.base_url, json=payload, headers=headers, timeout=45)
                response.raise_for_status()
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    sorted_data = sorted(data["data"], key=lambda x: x.get("index", 0))
                    all_embeddings.extend([item["embedding"] for item in sorted_data])
                else:
                    logger.error(f"Estructura inesperada en respuesta batch de embedding: {data}")
                    # Rellenar con ceros para este batch y no romper todo el proceso
                    all_embeddings.extend([[0.0] * 1536 for _ in batch_texts])
            except Exception as e:
                logger.error(f"Error generando embeddings batch ({i} to {i+batch_size}) con {self.model_name}: {e}")
                # Rellenar con ceros para este batch en caso de error
                all_embeddings.extend([[0.0] * 1536 for _ in batch_texts])
                
        return all_embeddings

openrouter_embeddings = OpenRouterEmbeddingsService()
