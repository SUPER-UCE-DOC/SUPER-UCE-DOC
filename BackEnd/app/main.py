import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, appointments, prescriptions, pharmacies, ai, realtime, invitations, sign_language
from app.services.sign_translator import sign_translator_service
from app.services.chatbot import medical_chatbot

# Configuración de logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Crear tablas en base de datos si no existen
logger.info("Inicializando esquemas de base de datos...")
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SUPER-UCE DOC Backend API",
    description=(
        "Servidor principal para la plataforma médica interdisciplinaria SUPER-UCE DOC. "
        "Permite el control de accesos por roles (RBAC), videoconsultas en tiempo real, "
        "emisión y despacho de recetas digitales geolocalizadas, traducción LSE asistida por LSTM+Qwen, "
        "y un chatbot clínico asistido por RAG."
    ),
    version="1.0.0"
)

# Habilitar CORS para permitir que el frontend React (Vite) se comunique con el backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar servicios de IA al arrancar
@app.on_event("startup")
def on_startup():
    from app.config import settings
    if settings.USE_LOCAL_LLM:
        logger.info(f"🤖 MODO IA ACTIVO: LOCAL Ollama ({settings.LOCAL_MODEL_NAME}) en {settings.OLLAMA_BASE_URL}")
    else:
        logger.info(f"⚡ MODO IA ACTIVO: NUBE Groq Cloud API (Modelo Llama-3.3 70B Versatile)")

    logger.info("Cargando base de conocimiento médico RAG...")
    medical_chatbot.load_knowledge()
    
    logger.info("Inicializando modelos de Inteligencia Artificial (LSTM & Qwen)...")
    sign_translator_service.load_models()
    
    logger.info("Precargando traductor de señas MarianMT en RAM...")
    try:
        from app.services.llm_translator import _load_model_if_needed
        _load_model_if_needed()
    except Exception as e:
        logger.warning(f"No se pudo precargar MarianMT en el arranque: {e}")
    
    logger.info("Arranque del servidor SUPER-UCE DOC completado.")

# Registrar routers
app.include_router(auth.router)
app.include_router(appointments.router)
app.include_router(prescriptions.router)
app.include_router(invitations.router)
app.include_router(pharmacies.router)
app.include_router(ai.router)
app.include_router(realtime.router)
app.include_router(sign_language.router)

@app.get("/")
def root():
    return {
        "app": "SUPER-UCE DOC Backend",
        "status": "active",
        "version": "1.0.0",
        "documentation": "/docs"
    }
