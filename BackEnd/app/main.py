import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, appointments, prescriptions, pharmacies, ai, realtime
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
    allow_origins=["*"],  # Permitir todos en desarrollo. Modificar para producción.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar servicios de IA al arrancar
@app.on_event("startup")
def on_startup():
    logger.info("Cargando base de conocimiento médico RAG...")
    medical_chatbot.load_knowledge()
    
    logger.info("Inicializando modelos de Inteligencia Artificial (LSTM & Qwen)...")
    sign_translator_service.load_models()
    
    logger.info("Arranque del servidor SUPER-UCE DOC completado.")

# Registrar routers
app.include_router(auth.router)
app.include_router(appointments.router)
app.include_router(prescriptions.router)
app.include_router(pharmacies.router)
app.include_router(ai.router)
app.include_router(realtime.router)

@app.get("/")
def root():
    return {
        "app": "SUPER-UCE DOC Backend",
        "status": "active",
        "version": "1.0.0",
        "documentation": "/docs"
    }
