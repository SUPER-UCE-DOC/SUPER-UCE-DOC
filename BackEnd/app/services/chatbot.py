import logging
import os
import re
import math
from typing import List, Tuple, Dict, Optional
import requests

from app.config import settings

logger = logging.getLogger(__name__)

class MedicalRAGChatbot:
    def __init__(self):
        self.knowledge_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
            "medical_knowledge"
        )
        self.chunks: List[str] = []
        self.sources: List[str] = []
        
        # Crear la carpeta de conocimiento si no existe
        if not os.path.exists(self.knowledge_dir):
            os.makedirs(self.knowledge_dir)
            self._seed_default_knowledge()

    def _seed_default_knowledge(self):
        """
        Crea documentos médicos de prueba en la carpeta de conocimiento.
        """
        filePath = os.path.join(self.knowledge_dir, "guia_clinica_super_uce.txt")
        content = (
            "GUÍA CLÍNICA DE ATENCIÓN PRIMARIA - SUPER-UCE DOC\n\n"
            "1. HIPERTENSIÓN ARTERIAL (HTA):\n"
            "- Diagnóstico: Presión arterial sistólica >= 140 mmHg o diastólica >= 90 mmHg medida en múltiples ocasiones.\n"
            "- Tratamiento inicial: Cambios en el estilo de vida (baja en sal, ejercicio). Tratamiento farmacológico común incluye: Enalapril (5mg-20mg por día), Losartán (25mg-100mg por día), Amlodipino (5mg-10mg).\n"
            "- Síntomas de alarma: Dolor de cabeza severo (cefalea), mareos intensos, visión borrosa, zumbido en los oídos (tinnitus), dolor de pecho.\n"
            "- Frecuencia de control: Pacientes estables cada 3-6 meses. Pacientes no controlados semanalmente.\n\n"
            "2. DIABETES MELLITUS TIPO 2:\n"
            "- Diagnóstico: Glucosa en ayunas >= 126 mg/dL, o hemoglobina glicosilada (HbA1c) >= 6.5%.\n"
            "- Tratamiento inicial: Metformina (500mg-2000mg diarios con alimentos) como fármaco de elección.\n"
            "- Síntomas comunes: Poliuria (mucha orina), polidipsia (mucha sed), pérdida de peso inexplicable, fatiga.\n"
            "- Cuidado de pies: Inspección diaria obligatoria para evitar úlceras diabéticas.\n\n"
            "3. ANSIEDAD GENERALIZADA:\n"
            "- Tratamiento farmacológico de apoyo: ISRS como Sertralina (50mg diarios) o Escitalopram.\n"
            "- Recomendaciones: Terapia cognitivo-conductual, evitar estimulantes (café, té, refrescos de cola).\n\n"
            "4. PROTOCOLO DE VIDEOCONSULTAS Y RECETAS:\n"
            "- Las recetas digitales emitidas tienen una validez estándar de 30 días.\n"
            "- Las recetas se geolocalizan automáticamente para enviarse a farmacias en un radio de 2 km a la redonda del paciente para su despacho inmediato.\n"
            "- Las farmacias deben restar el stock inmediatamente al despachar la receta en una transacción ACID segura.\n"
        )
        try:
            with open(filePath, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info("Base de conocimiento sembrada con éxito.")
        except Exception as e:
            logger.error(f"No se pudo sembrar base de conocimiento por defecto: {e}")

    def load_knowledge(self):
        """
        Lee todos los archivos de texto de la carpeta `medical_knowledge` y los divide en chunks de párrafos.
        """
        self.chunks = []
        self.sources = []
        
        if not os.path.exists(self.knowledge_dir):
            return
            
        for filename in os.listdir(self.knowledge_dir):
            if filename.endswith(".txt"):
                filepath = os.path.join(self.knowledge_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        text = f.read()
                    
                    # Dividimos por párrafos o líneas en blanco dobles
                    file_chunks = [c.strip() for c in re.split(r'\n\s*\n', text) if c.strip()]
                    for chunk in file_chunks:
                        self.chunks.append(chunk)
                        self.sources.append(filename)
                except Exception as e:
                    logger.error(f"Error leyendo {filename}: {e}")
                    
        logger.info(f"Cargados {len(self.chunks)} bloques de conocimiento médico.")

    def _simple_similarity_search(self, query: str, top_k: int = 3) -> List[Tuple[str, str]]:
        """
        Búsqueda simple por solapamiento de palabras (Heurística/TF-IDF simplificado)
        para cuando no hay internet o API de embeddings activa.
        """
        query_words = set(re.findall(r'\w+', query.lower()))
        if not query_words:
            return []
            
        scored_chunks = []
        for i, chunk in enumerate(self.chunks):
            chunk_words = re.findall(r'\w+', chunk.lower())
            overlap = len(query_words.intersection(chunk_words))
            # Calcular una puntuación básica
            score = overlap / (math.log(len(chunk_words) + 1) + 1.0)
            if score > 0:
                scored_chunks.append((score, chunk, self.sources[i]))
                
        # Ordenar por puntaje descendente
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [(chunk, source) for _, chunk, source in scored_chunks[:top_k]]

    def retrieve_context(self, query: str, top_k: int = 2) -> Tuple[str, List[str]]:
        """
        Busca los bloques de texto más relevantes en la base de conocimiento local.
        """
        if not self.chunks:
            self.load_knowledge()
            
        if not self.chunks:
            return "No hay base de conocimiento cargada.", []

        # Intentar búsqueda vectorial gratuita usando API de Embeddings de HuggingFace
        try:
            # Usaremos una aproximación robusta por solapamiento de palabras
            # que es 100% offline, confiable y rápida para desarrollo.
            matches = self._simple_similarity_search(query, top_k)
            if matches:
                context_str = "\n---\n".join([f"[Fuente: {source}]\n{chunk}" for chunk, source in matches])
                sources = list(set([source for _, source in matches]))
                return context_str, sources
        except Exception as e:
            logger.error(f"Error en búsqueda de contexto: {e}")
            
        return "", []

    def ask(self, query: str, chat_history: Optional[List[dict]] = None) -> Tuple[str, List[str]]:
        """
        Consulta al chatbot. Primero recupera el contexto médico local y luego
        utiliza la API gratuita de Groq o el modelo Qwen para generar la respuesta.
        """
        context, sources = self.retrieve_context(query)
        
        # Si no hay contexto de fuentes, definimos fuentes como la base general
        if not sources:
            sources = ["Base General UCE"]

        # Construir el prompt del chatbot con el contexto médico inyectado (RAG)
        system_prompt = (
            "Eres el asistente virtual médico oficial de SUPER-UCE DOC. "
            "Tu misión es responder preguntas de salud de manera clara, amable, empática e inclusiva. "
            "Responde basándote estrictamente en el siguiente contexto clínico de confianza:\n"
            "---------------------\n"
            f"{context}\n"
            "---------------------\n"
            "REGLAS:\n"
            "1. Si la respuesta no se encuentra en el contexto clínico anterior, debes responder con empatía usando tu conocimiento general pero advirtiendo al paciente que es una sugerencia general y que debe consultar con su médico.\n"
            "2. Nunca inventes datos farmacológicos o dosis que no estén confirmados.\n"
            "3. Si detectas síntomas de alarma (dolor de pecho fuerte, cefalea severa repentina, mareos con pérdida de conciencia), instruye inmediatamente al usuario a acudir a urgencias o llamar al 911."
        )

        # 1. Intentar usar la API Gratuita de Groq (Llama-3 8B)
        if settings.GROQ_API_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                
                messages = [{"role": "system", "content": system_prompt}]
                if chat_history:
                    # Añadir últimos 4 mensajes del historial para no sobrecargar
                    for msg in chat_history[-4:]:
                        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
                messages.append({"role": "user", "content": query})
                
                payload = {
                    "model": "llama-3.1-8b-instant",
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 512
                }
                
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=7
                )
                
                if response.status_code == 200:
                    resp_json = response.json()
                    reply = resp_json["choices"][0]["message"]["content"].strip()
                    return reply, sources
                else:
                    logger.warning(f"Groq API devolvió código de error {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"Error llamando a Groq API: {e}")

        # 2. Intentar usar la API de Inferencia gratuita de Hugging Face
        try:
            hf_url = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-1.5B-Instruct"
            full_prompt = (
                f"<|system|>\n{system_prompt}\n"
                f"<|user|>\nPregunta del paciente: {query}\n"
                f"<|assistant|>\n"
            )
            response = requests.post(
                hf_url,
                json={"inputs": full_prompt, "parameters": {"max_new_tokens": 250, "temperature": 0.3}},
                timeout=5
            )
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    text = result[0].get("generated_text", "")
                    clean_reply = text.replace(full_prompt, "").strip()
                    return clean_reply, sources
        except Exception as e:
            logger.debug(f"HF Chatbot Fallback no disponible: {e}")

        # 3. Fallback Heurístico local (Sin internet y sin API Key)
        reply = (
            "Hola. He recibido tu consulta en modo offline. Basándome en la guía médica del centro:\n"
        )
        query_lower = query.lower()
        if "presion" in query_lower or "hipertension" in query_lower or "cabeza" in query_lower:
            reply += (
                "Para la Hipertensión Arterial (HTA), recuerda controlar tu presión periódicamente. "
                "Los fármacos de uso común en la guía son Losartán o Enalapril. Si experimentas dolor de cabeza severo o mareo intenso, "
                "por favor ponte en contacto con tu médico asignado o asiste al centro de salud más cercano."
            )
        elif "diabetes" in query_lower or "azucar" in query_lower or "glucosa" in query_lower:
            reply += (
                "Para el control de Diabetes Tipo 2, el medicamento base recomendado en la clínica es la Metformina. "
                "Es vital que revises diariamente tus pies para prevenir úlceras y mantengas un monitoreo de tu glucosa capilar."
            )
        elif "ansiedad" in query_lower or "estres" in query_lower:
            reply += (
                "Para cuadros de ansiedad, la Sertralina suele ser el tratamiento médico de apoyo recomendado. "
                "Se aconseja suspender el café, bebidas energéticas o cualquier estimulante que eleve tu ritmo cardíaco."
            )
        else:
            reply += (
                "Tu consulta ha sido recibida. Te recordamos asistir a tu próxima videoconsulta agendada. "
                "Si tienes dudas específicas sobre recetas y dosis, puedes revisarlas en la sección 'Mis Recetas'."
            )
            
        return reply, sources

# Instancia global del chatbot
medical_chatbot = MedicalRAGChatbot()
