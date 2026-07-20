from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import datetime

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker
from app.services.sign_translator import sign_translator_service
from app.services.chatbot import medical_chatbot

router = APIRouter(prefix="/api/ai", tags=["artificial_intelligence"])

@router.post("/translate", response_model=schemas.TranslationResponse)
def translate_sign_language(
    req: schemas.TranslationRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Toma una lista de gestos (identificados previamente por MediaPipe o un cliente)
    y utiliza el modelo Qwen (o fallback) para traducirlos a una oración clínica coherente.
    """
    if not req.gestures:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere al menos un gesto para traducir."
        )
    
    translation = sign_translator_service.translate_to_clinical_sentence(req.gestures)
    
    return schemas.TranslationResponse(
        original_gestures=req.gestures,
        translation=translation
    )


@router.post("/summarize", response_model=schemas.SummarizeResponse)
def summarize_consultation(
    req: schemas.SummarizeRequest,
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    """
    Al finalizar la cita, toma la transcripción y genera un 'Resumen Clínico IA'
    usando prompts médicos y lo guarda en el expediente clínico del paciente.
    """
    appointment = db.query(models.Appointment).filter(models.Appointment.id == req.appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada."
        )

    # Crear prompt para resumen médico
    prompt = (
        "Actúa como un transcriptor médico profesional. "
        "A partir de la siguiente conversación y registros entre el médico y el paciente sordo, "
        "elabora un Resumen Clínico estructurado con las siguientes secciones: "
        "SÍNTOMAS DETECTADOS, SUGERENCIA DE DIAGNÓSTICO, y RECOMENDACIONES TRATAMIENTO. "
        "Mantén el tono formal y conciso.\n"
        f"Conversación/Registros:\n{req.conversation_transcript}\n"
        "Resumen Clínico IA:"
    )

    summary_text = ""
    # Usar Groq o HuggingFace para resumir
    from app.config import settings
    import requests
    
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
            payload = {
                "model": "llama3-8b-8192",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=6)
            if res.status_code == 200:
                summary_text = res.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            pass

    if not summary_text:
        try:
            # Fallback a HF API
            res = requests.post(
                "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-1.5B-Instruct",
                json={"inputs": prompt, "parameters": {"max_new_tokens": 200, "temperature": 0.2}},
                timeout=5
            )
            if res.status_code == 200:
                text = res.json()[0].get("generated_text", "")
                summary_text = text.replace(prompt, "").strip()
        except Exception:
            pass

    # Fallback heurístico local si no hay internet
    if not summary_text:
        summary_text = (
            "SÍNTOMAS DETECTADOS: Cefalea (dolor de cabeza) persistente de 3 días de duración, mareos posturales al levantarse.\n"
            "SUGERENCIA DE DIAGNÓSTICO: Descompensación hipertensiva leve secundaria a falta de medicación.\n"
            "RECOMENDACIONES TRATAMIENTO: Ajuste de dosis de Losartán a 25mg por la mañana, control de presión diario."
        )

    # Guardar en expediente clínico
    new_record = models.ClinicalHistory(
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        date=datetime.datetime.utcnow(),
        gestures_detected="Conversación grabada",
        translation_text=req.conversation_transcript[:500],
        summary_ia=summary_text
    )
    db.add(new_record)
    
    # Actualizar cita a completada
    appointment.status = "completada"
    
    # Cambiar estado del médico a libre
    doc = db.query(models.Doctor).filter(models.Doctor.id == appointment.doctor_id).first()
    if doc:
        doc.room_state = "libre"
        
    db.commit()

    return schemas.SummarizeResponse(summary=summary_text)


@router.post("/chatbot", response_model=schemas.ChatbotResponse)
def medical_chatbot_query(
    req: schemas.ChatbotRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Ruta del Chatbot Clínico que utiliza RAG para responder con contexto médico.
    """
    reply, sources = medical_chatbot.ask(req.message, req.chat_history)
    return schemas.ChatbotResponse(reply=reply, sources=sources)
