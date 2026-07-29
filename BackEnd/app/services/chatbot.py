# Trigger reload: contexto plataforma
# Trigger reload 2: fix UCE acronym
# Trigger reload 3: load new medical protocols (Dengue, CBME)
# Trigger reload 4: load dense protocols (Infectious, Maternal)
# Trigger reload 5: load Claude's massive medication list
import logging
import os
import re
import math
import threading
from typing import List, Tuple, Dict, Optional
import requests
from sqlalchemy.orm import Session

from app.config import settings
from app.services.memory_manager import memory_manager
from app.services.knowledge_extraction_service import knowledge_extraction_service
from app.services.patient_memory_service import patient_memory_service
from app.services.conversation_service import conversation_service

logger = logging.getLogger(__name__)

class MedicalRAGChatbot:
    def __init__(self):
        self.knowledge_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
            "medical_knowledge"
        )
        self.vector_db_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
            "medical_knowledge_vectors"
        )
        self.chunks: List[str] = []
        self.sources: List[str] = []
        
        # Inicializar ChromaDB (Base Vectorial)
        try:
            import chromadb
            self.chroma_client = chromadb.PersistentClient(path=self.vector_db_dir)
            self.collection = self.chroma_client.get_or_create_collection(name="medical_knowledge")
            self.use_vector_db = True
        except ImportError:
            logger.error("ChromaDB no está instalado. Usando RAG básico (simple_similarity_search).")
            self.use_vector_db = False
            self.chroma_client = None
            self.collection = None
        
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
        Los inyecta en ChromaDB para búsquedas vectoriales.
        """
        self.chunks = []
        self.sources = []
        
        if not os.path.exists(self.knowledge_dir):
            return
            
        new_documents = []
        new_metadatas = []
        new_ids = []
        chunk_idx = 0

        for filename in os.listdir(self.knowledge_dir):
            if filename.endswith(".txt"):
                filepath = os.path.join(self.knowledge_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        text = f.read()
                    
                    # Dividimos por párrafos o líneas en blanco dobles
                    file_chunks = [c.strip() for c in re.split(r'\n\s*\n', text) if c.strip()]
                    for chunk in file_chunks:
                        if len(chunk) < 10:
                            continue # Evitar chunks vacíos o inútiles
                        self.chunks.append(chunk)
                        self.sources.append(filename)
                        
                        # Preparar listas para ChromaDB
                        new_documents.append(chunk)
                        new_metadatas.append({"source": filename})
                        new_ids.append(f"{filename}_chunk_{chunk_idx}")
                        chunk_idx += 1
                except Exception as e:
                    logger.error(f"Error leyendo {filename}: {e}")
                    
        # Inyectar a ChromaDB si está activo
        if self.use_vector_db and self.collection and new_documents:
            try:
                # Borramos la colección para recargar todo en caso de cambios en los .txt
                self.chroma_client.delete_collection(name="medical_knowledge")
                self.collection = self.chroma_client.create_collection(name="medical_knowledge")
                
                # Insertamos los documentos vectorizados
                self.collection.add(
                    documents=new_documents,
                    metadatas=new_metadatas,
                    ids=new_ids
                )
                logger.info(f"Cargados {len(new_documents)} bloques vectoriales en ChromaDB local.")
            except Exception as e:
                logger.error(f"Error cargando vectores en ChromaDB: {e}")
                
        logger.info(f"Base de conocimiento lista. Modo: {'Vectorial (ChromaDB)' if self.use_vector_db else 'Texto Simple'}")

    def _simple_similarity_search(self, query: str, top_k: int = 3) -> List[Tuple[str, str]]:
        """
        Búsqueda simple por solapamiento de palabras (Heurística/TF-IDF simplificado)
        para cuando no hay internet o API de embeddings activa.
        """
        GENERIC_WORDS = {
            "de", "la", "que", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un", "para", "con", "no", 
            "una", "su", "al", "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este", "sí", "porque", "esta", 
            "entre", "cuando", "muy", "sin", "sobre", "también", "me", "hasta", "hay", "donde", "quien", "desde", 
            "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", 
            "e", "esto", "mí", "antes", "algunos", "qué", "unos", "yo", "otro", "otras", "otra", "él", "tanto", "esa", 
            "estos", "mucho", "quienes", "nada", "muchos", "cual", "poco", "ella", "estar", "estas", "algunas", "algo", 
            "nosotros", "mi", "mis", "tú", "te", "ti", "tu", "tus", "ellas", "nosotras", "cuáles", "son", "cuál", "es",
            # Palabras genéricas médicas que no deben contar como coincidencia local única
            "síntomas", "sintomas", "dolor", "cabeza", "tomar", "recomiendas", "medicamento", "medicamentos", 
            "tratamiento", "paciente", "medico", "médico", "medicina", "salud", "enfermedad", "casos", "atención", 
            "atencion", "clinica", "clínica", "guia", "guía", "protocolo", "protocolos",
            "último", "ultimo", "hacer", "saber", "decir", "tener", "tiene", "ver", "esto", "creo", "creó"
        }
        query_words = set(re.findall(r'\w+', query.lower())) - GENERIC_WORDS
        if not query_words:
            return []
            
        scored_chunks = []
        for i, chunk in enumerate(self.chunks):
            chunk_words = set(re.findall(r'\w+', chunk.lower())) - GENERIC_WORDS
            overlap = len(query_words.intersection(chunk_words))
            # Para coincidir localmente debe haber al menos 1 palabra ESPECÍFICA relevante (ej. hipertension, dengue, etc.)
            if overlap >= 1:
                score = overlap / (math.log(len(chunk_words) + 1) + 1.0)
                scored_chunks.append((score, chunk, self.sources[i]))
                
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [(chunk, source) for _, chunk, source in scored_chunks[:top_k]]

    def _web_search(self, query: str, max_results: int = 5) -> Tuple[str, List[str]]:
        """
        Búsqueda web profesional usando Tavily API (si está configurada) o DuckDuckGo como fallback.
        """
        snippets = []
        sources = []
        
        # Intento 0: Tavily API (Nivel Industria para LLMs)
        if settings.TAVILY_API_KEY:
            try:
                from tavily import TavilyClient
                logger.info(f"Ejecutando búsqueda web profesional Tavily para: '{query}'")
                tavily = TavilyClient(api_key=settings.TAVILY_API_KEY)
                
                # Heurística para forzar resultados recientes si la query implica novedad
                search_kwargs = {
                    "query": query, 
                    "search_depth": "advanced", 
                    "max_results": max_results
                }
                
                if any(word in query.lower() for word in ["último", "ultimo", "últimos", "ultimos", "nuevo", "nuevos", "reciente", "recientes", "202"]):
                    search_kwargs["time_range"] = "year"
                
                response = tavily.search(**search_kwargs)
                results = response.get("results", [])
                if results:
                    for r in results:
                        title = r.get("title", "Fuente Web")
                        content = r.get("content", "")
                        if content:
                            snippets.append(f"[Fuente Web: {title}]\n{content}")
                            sources.append(title)
                    if snippets:
                        context_str = "\n---\n".join(snippets)
                        return context_str, sources
            except Exception as e:
                logger.error(f"Error llamando a Tavily API: {e}")

        # Intento 1: Librería DDGS (Fallback)
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS

            logger.info(f"Ejecutando búsqueda web DDGS para: '{query}'")
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                if results:
                    for r in results:
                        title = r.get("title", "Fuente Web")
                        body = r.get("body", "")
                        if body:
                            snippets.append(f"[Fuente Web: {title}]\n{body}")
                            sources.append(title)
        except Exception as e:
            logger.error(f"Error en librería DDGS: {e}")

        # Intento 2: Fallback directo a html.duckduckgo.com vía HTTP si todo lo demás devolvió 0 resultados
        if not snippets:
            try:
                import html
                logger.info(f"Ejecutando fallback HTTP directo a DuckDuckGo para: '{query}'")
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded"
                }
                resp = requests.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query},
                    headers=headers,
                    timeout=6
                )
                if resp.status_code == 200:
                    raw_snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', resp.text, re.DOTALL)
                    raw_titles = re.findall(r'<a class="result__a[^>]*>(.*?)</a>', resp.text, re.DOTALL)
                    for i in range(min(len(raw_snippets), max_results)):
                        clean_title = re.sub(r'<[^>]+>', '', raw_titles[i]).strip() if i < len(raw_titles) else "Fuente Web"
                        clean_snippet = re.sub(r'<[^>]+>', '', raw_snippets[i]).strip()
                        clean_snippet = html.unescape(clean_snippet)
                        clean_title = html.unescape(clean_title)
                        if clean_snippet:
                            snippets.append(f"[Fuente Web: {clean_title}]\n{clean_snippet}")
                            sources.append(clean_title)
            except Exception as e:
                logger.error(f"Error en fallback HTTP DuckDuckGo: {e}")

        if snippets:
            context_str = "\n---\n".join(snippets)
            return context_str, sources

        return "", []

    def retrieve_context(self, query: str, top_k: int = 2) -> Tuple[str, List[str]]:
        """
        Busca los bloques de texto más relevantes en la base de conocimiento local.
        Si no encuentra nada, realiza una búsqueda web en vivo.
        """
        if not self.chunks:
            self.load_knowledge()

        # 1. Intentar búsqueda Vectorial con ChromaDB
        if self.use_vector_db and self.collection:
            try:
                results = self.collection.query(
                    query_texts=[query],
                    n_results=top_k
                )
                
                if results['documents'] and len(results['documents'][0]) > 0:
                    docs = results['documents'][0]
                    metadatas = results['metadatas'][0]
                    distances = results['distances'][0] if 'distances' in results and results['distances'] else []
                    
                    # Si la distancia (1 - similitud del coseno) es muy alta (>1.5), podría ser irrelevante
                    # Pero dejaremos que el modelo RAG lo decida por ahora, o aplicaremos un threshold simple
                    valid_docs = []
                    valid_sources = []
                    
                    for i, doc in enumerate(docs):
                        if distances and distances[i] > 1.8:
                            continue # Ignorar documentos demasiado lejanos
                        valid_docs.append(f"[Fuente Local Vectorial: {metadatas[i]['source']}]\n{doc}")
                        valid_sources.append(metadatas[i]['source'])
                        
                    if valid_docs:
                        context_str = "\n---\n".join(valid_docs)
                        logger.info("Búsqueda vectorial (ChromaDB) realizada exitosamente.")
                        return context_str, list(set(valid_sources))
            except Exception as e:
                logger.error(f"Error en búsqueda vectorial: {e}")

        # 2. Fallback a búsqueda local clásica de texto
        try:
            matches = self._simple_similarity_search(query, top_k)
            if matches:
                context_str = "\n---\n".join([f"[Fuente Local Texto: {source}]\n{chunk}" for chunk, source in matches])
                sources = list(set([source for _, source in matches]))
                return context_str, sources
        except Exception as e:
            logger.error(f"Error en búsqueda de contexto local por texto: {e}")

        logger.info("No se encontró contexto local. El modelo usará su conocimiento pre-entrenado.")
        return "", []

    def ask(self, query: str, chat_history: Optional[List[dict]] = None, user_context: str = "", attached_doc_ids: Optional[List[str]] = None, db: Session = None, session_id: int = None, patient_id: int = None) -> Tuple[str, List[str]]:
        """
        Punto de entrada principal.
        """
        return self.get_response(query, chat_history, user_context, attached_doc_ids, db, session_id, patient_id)

    def _reformulate_query(self, query: str, chat_history: List[dict]) -> str:
        """
        Usa Gemini 2.5 Flash para reescribir consultas ambiguas basándose en el historial de chat,
        creando una consulta autónoma perfecta para búsqueda vectorial.
        """
        if not chat_history:
            return query
            
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            history_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in chat_history[-4:]])
            prompt = (
                "Dada la siguiente historia de conversación y una nueva pregunta del usuario, "
                "reescribe la nueva pregunta para que sea una consulta de búsqueda completamente "
                "autónoma y específica. Si la pregunta original ya es específica o cambia de tema, "
                "déjala igual. NO respondas a la pregunta, solo devuelve la consulta reescrita.\n\n"
                f"Historial:\n{history_text}\n\n"
                f"Pregunta original: {query}\n"
                "Consulta reescrita:"
            )
            
            payload = {
                "model": "google/gemini-2.5-flash",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": 100
            }
            
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=8)
            if res.status_code == 200:
                reformulated = res.json()["choices"][0]["message"]["content"].strip().strip('"\'')
                logger.info(f"[Query Reformulation] Original: '{query}' -> Reformulada: '{reformulated}'")
                return reformulated
        except Exception as e:
            logger.error(f"Error en _reformulate_query: {e}")
            
        return query

    def get_response(self, query: str, chat_history: Optional[List[dict]] = None, user_context: str = "", attached_doc_ids: Optional[List[str]] = None, db: Session = None, session_id: int = None, patient_id: int = None) -> Tuple[str, List[str]]:
        """
        Consulta al chatbot con la nueva Arquitectura de Memoria Híbrida Inteligente.
        """
        if not query or not query.strip():
            query = "Por favor analiza los documentos adjuntos." if attached_doc_ids else "Hola."

        sources = ["Historial Clínico del Paciente", "Memoria Persistente Híbrida"]
        
        # 1. Guardar mensaje del usuario si hay sesión
        if session_id and db:
            conversation_service.save_message(db, session_id, "user", query, tokens_count=conversation_service.estimate_tokens(query))
            
            # 2. Extracción de Conocimiento en 2do Plano
            def extract_and_save():
                try:
                    from app.database import SessionLocal
                    bg_db = SessionLocal()
                    facts = knowledge_extraction_service.extract_knowledge(query)
                    for fact in facts:
                        patient_memory_service.upsert_memory(
                            bg_db, patient_id, memory_type=fact.get("type", "dato"), 
                            value=fact.get("value", ""), origin="inferencia"
                        )
                    bg_db.close()
                except Exception as e:
                    logger.error(f"Error en extracción asíncrona: {e}")
            
            # Iniciar hilo de extracción para no bloquear la respuesta
            threading.Thread(target=extract_and_save).start()

        import datetime
        current_date = datetime.date.today().strftime("%Y-%m-%d")

        system_prompt = (
            f"Eres SUPER-UCE DOC, un asistente virtual clínico inteligente, empático, muy amable y profesional de nivel especialista.\n"
            f"La fecha actual es {current_date}.\n"
        )
        medical_rules = (
            "- TELECONSULTAS Y VIDEOLLAMADAS: Se realizan 100% DIRECTAMENTE DENTRO DE LA PLATAFORMA. NUNCA digas que se usará llamada telefónica o WhatsApp.\n"
            "- HISTORIAL Y ANALÍTICAS: Visibles directamente en el panel del doctor.\n"
            "- CERO CONTRADICCIONES: Mantén coherencia total con tus respuestas previas y con la memoria del paciente.\n"
            "- Hablas DIRECTAMENTE al paciente en segunda persona ('tienes', 'tus medicamentos').\n"
            "- NATURALIDAD EXTREMA: Responde de forma muy fluida, conversacional y humana. NO repitas el nombre del paciente en cada mensaje (úsalo solo al inicio de la conversación si es natural). NO repitas mecánicamente la pregunta o información que te acaban de dar. Ve directo al grano.\n"
            "- NUNCA repitas introducciones robóticas como 'según la base de datos' o 'revisando tu historial'.\n"
            "- CRÍTICO: JAMÁS digas que no tienes la capacidad de abrir, ver o leer archivos adjuntos (ni que eres un asistente de texto). El texto de los documentos adjuntos YA fue extraído y está en tu contexto. Asume que lo estás leyendo directamente.\n"
            "- REGLA DE ORO SOBRE DOCUMENTOS: Si el usuario pregunta por 'este documento', 'este archivo' o pide analizar un adjunto, DEBES buscar EXCLUSIVAMENTE dentro de las etiquetas <documentos_adjuntos_actuales>. Si esas etiquetas están vacías, respóndele con mucha empatía diciéndole que te encantaría ayudarle con su documento/archivo, pero que parece que aún no lo ha subido a la plataforma. BAJO NINGUNA CIRCUNSTANCIA asumas que 'este documento' se refiere a su <historial_clinico_bd>.\n"
            f"<historial_clinico_bd>\n{user_context}\n</historial_clinico_bd>"
        )

        # 2.5 Query Reformulation
        search_query = query
        if chat_history:
            search_query = self._reformulate_query(query, chat_history)

        # 3. Memory Manager construye el contexto inmutable
        if db and session_id and patient_id:
            context_dict = memory_manager.build_optimal_context(
                db=db, session_id=session_id, patient_id=patient_id,
                user_message=query, system_prompt=system_prompt, medical_rules=medical_rules,
                doc_ids=attached_doc_ids, search_query=search_query
            )
        else:
            context_dict = {
                "system_instruction": f"{system_prompt}\n{medical_rules}",
                "patient_context": "",
                "teleconsultation_context": "",
                "conversation_summary": "",
                "rag_context": "",
                "conversation_history": [],
                "user_message": query
            }

        def sanitize_reply(text: str) -> str:
            text = text.strip()
            text = re.sub(r"^(sin embargo|no obstante|por lo tanto|además|ademas|así que|asi que),\s*", "", text, flags=re.IGNORECASE)
            if text:
                text = text[0].upper() + text[1:]
            return text
            
        # Ensamblaje nativo de contexto dinámico con Etiquetas XML (Industry Standard)
        dynamic_context = "[CONOCIMIENTO INTERNO SUBCONSCIENTE - NO LO MENCIONES EXPLÍCITAMENTE A MENOS QUE SEA RELEVANTE]\n"
        if context_dict["patient_context"]:
            dynamic_context += f"\n<memoria_paciente>\n{context_dict['patient_context']}\n</memoria_paciente>"
        if context_dict["teleconsultation_context"]:
            dynamic_context += f"\n<resumenes_clinicos_previos>\n{context_dict['teleconsultation_context']}\n</resumenes_clinicos_previos>"
        
        # Siempre incluimos la etiqueta de adjuntos para que la "Regla de Oro" sepa si está vacía
        if context_dict["rag_context"]:
            dynamic_context += f"\n<documentos_adjuntos_actuales>\n{context_dict['rag_context']}\n</documentos_adjuntos_actuales>"
        else:
            dynamic_context += f"\n<documentos_adjuntos_actuales></documentos_adjuntos_actuales>"
            
        if context_dict["conversation_summary"]:
            dynamic_context += f"\n<resumen_conversacion_antigua>\n{context_dict['conversation_summary']}\n</resumen_conversacion_antigua>"

        # 1. Intentar usar la API de Ollama Local (Llama-3.1 8B)
        if settings.USE_LOCAL_LLM:
            try:
                messages = [
                    {"role": "system", "content": context_dict["system_instruction"]},
                    {"role": "system", "content": dynamic_context}
                ]
                if context_dict["conversation_history"]:
                    messages.extend(context_dict["conversation_history"])

                user_message_content = f"Pregunta actual del paciente: {context_dict['user_message']}"
                messages.append({"role": "user", "content": user_message_content})
                
                payload = {
                    "model": settings.LOCAL_MODEL_NAME,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "num_predict": 500,
                        "temperature": 0.2
                    }
                }
                
                url = f"{settings.OLLAMA_BASE_URL}/api/chat"
                response = requests.post(url, json=payload, timeout=120)
                
                if response.status_code == 200:
                    resp_json = response.json()
                    reply = sanitize_reply(resp_json["message"]["content"])
                    return reply, sources
            except Exception as e:
                logger.error(f"Error llamando a Ollama API local: {e}")

        # 2. Intentar usar la API de OpenRouter con Gemini 2.5 Flash
        if settings.OPENROUTER_API_KEY:
            try:
                headers = {
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "SUPER-UCE DOC"
                }

                messages = [
                    {"role": "system", "content": context_dict["system_instruction"]},
                    {"role": "system", "content": dynamic_context}
                ]
                
                if context_dict["conversation_history"]:
                    messages.extend(context_dict["conversation_history"])
                    
                messages.append({"role": "user", "content": context_dict["user_message"]})
                
                payload = {
                    "model": settings.OPENROUTER_MODEL,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 1200
                }
                
                logger.info(f"Llamando a OpenRouter API con modelo {settings.OPENROUTER_MODEL} (API Key activa: {settings.OPENROUTER_API_KEY[:8]}...)")
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=25
                )
                
                if response.status_code == 200:
                    resp_json = response.json()
                    reply = sanitize_reply(resp_json["choices"][0]["message"]["content"])
                    logger.info("Respuesta obtenida con ÉXITO de OpenRouter Gemini 2.5 Flash!")
                    
                    # 4. Guardar respuesta de la IA en el historial reciente
                    if session_id and db:
                        conversation_service.save_message(db, session_id, "assistant", reply, tokens_count=conversation_service.estimate_tokens(reply))
                        
                    return reply, sources
                else:
                    logger.error(f"OpenRouter API devolvió HTTP {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"Error llamando a OpenRouter API: {e}")

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
                    return sanitize_reply(clean_reply), sources
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
