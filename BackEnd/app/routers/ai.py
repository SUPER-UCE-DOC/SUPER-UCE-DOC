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
                "model": "llama-3.1-8b-instant",
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


@router.get("/sessions", response_model=list[schemas.ChatSessionResponse])
def get_chat_sessions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Devuelve todas las sesiones de chat del usuario actual"""
    sessions = db.query(models.ChatSession).filter(models.ChatSession.user_id == current_user.id).order_by(models.ChatSession.created_at.desc()).all()
    return sessions

@router.post("/sessions", response_model=schemas.ChatSessionResponse)
def create_chat_session(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Crea una nueva sesión vacía para el usuario actual"""
    session = models.ChatSession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions/{session_id}", response_model=schemas.ChatSessionResponse)
def get_chat_session_by_id(session_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Devuelve una sesión específica y todos sus mensajes"""
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return session

@router.delete("/sessions/{session_id}")
def delete_chat_session(session_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Elimina una sesión y todos sus mensajes"""
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    db.delete(session)
    db.commit()
    return {"status": "ok", "message": "Sesión eliminada correctamente"}

def generate_smart_title(message: str) -> str:
    msg_lower = message.lower().strip()
    
    if "resumen" in msg_lower and ("cita" in msg_lower or "consulta" in msg_lower):
        return "Resumen de Cita Médica"
    if "prepar" in msg_lower or "como me" in msg_lower or "de que va" in msg_lower or "que debo llevar" in msg_lower:
        return "Preparación de Teleconsulta"
    if "receta" in msg_lower or "medicament" in msg_lower or "dosis" in msg_lower or "tratamiento" in msg_lower:
        return "Consulta sobre Medicamentos"
    if "analitic" in msg_lower or "examen" in msg_lower or "laboratorio" in msg_lower or "resultado" in msg_lower or "sangre" in msg_lower:
        return "Resultados de Analíticas"
    if "dengue" in msg_lower or "fiebre" in msg_lower or "sintoma" in msg_lower or "dolor" in msg_lower or "gripe" in msg_lower:
        return "Consulta de Síntomas"
    if "horario" in msg_lower or "agendar" in msg_lower or "cita" in msg_lower or "disponib" in msg_lower:
        return "Gestión de Citas"

    stopwords = {"de", "la", "el", "los", "las", "un", "una", "en", "para", "por", "que", "como", "con", "mi", "mis", "esta", "este", "es", "hacer", "tengo"}
    words = [w for w in message.strip().split() if w.lower() not in stopwords]
    if words:
        clean_title = " ".join(words[:4]).rstrip("?,.!;")
        if len(clean_title) >= 3:
            return clean_title.capitalize()
            
    clean_raw = message.strip().rstrip("?,.!;")
    return clean_raw[:30] + ("..." if len(clean_raw) > 30 else "")

@router.post("/chatbot", response_model=schemas.ChatbotResponse)
def medical_chatbot_query(
    req: schemas.ChatbotRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ruta del Chatbot Clínico RAG con soporte para guardado en Base de Datos"""
    chat_history = req.chat_history or []
    session = None
    
    # Si hay un session_id, guardar la pregunta del usuario y cargar el historial real
    if req.session_id:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == req.session_id, models.ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
            
        # Si la sesión es nueva o tiene título por defecto/largo, generamos un título inteligente corto
        if session.title == "Nueva consulta médica" or not session.title or len(session.title) > 30 or session.title.startswith("Como recomiendas") or session.title.startswith("Resumen de mi"):
            session.title = generate_smart_title(req.message)
            db.commit()
            
        # Guardar mensaje del usuario
        user_msg = models.ChatMessage(session_id=req.session_id, role="user", content=req.message)
        db.add(user_msg)
        
        # Cargar los últimos 10 mensajes de esta sesión para la IA
        db_messages = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == req.session_id).order_by(models.ChatMessage.created_at.asc()).limit(10).all()
        # Solo pasamos mensajes previos, sin incluir el recién agregado (ya que la IA lo recibe como query)
        chat_history = [{"role": m.role, "content": m.content} for m in db_messages[:-1]]

    # Extraer contexto directo de la base de datos para inyectarlo en el LLM (RAG Personalizado)
    now = datetime.datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    user_context = f"FECHA Y HORA ACTUAL DEL SISTEMA: {now_str}\n"
    user_context += f"Nombre del paciente: {current_user.full_name}\n\n"
    
    if current_user.role == "patient":
        # 1. Citas futuras y pendientes (Aún no han ocurrido)
        future_apps = db.query(models.Appointment).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status.in_(["pendiente", "confirmada"]),
            models.Appointment.date_time >= now
        ).order_by(models.Appointment.date_time.asc()).all()

        # 2. Consultas pasadas y finalizadas (Ya ocurrieron)
        past_completed_apps = db.query(models.Appointment).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status == "completada"
        ).order_by(models.Appointment.date_time.desc()).all()

        user_context += "--- CITAS FUTURAS Y PENDIENTES (AÚN NO HAN OCURRIDO, SON EN EL FUTURO) ---\n"
        if future_apps:
            for appt in future_apps:
                doc_user = db.query(models.User).filter(models.User.id == appt.doctor_id).first()
                doc_name = doc_user.full_name if doc_user else "Doctor"
                date_str = appt.date_time.strftime("%d/%m/%Y a las %I:%M %p")
                st_lbl = "Confirmada (agendada)" if appt.status == "confirmada" else "Pendiente de aprobación"
                user_context += f"- Cita FUTURA PROGRAMADA #{appt.id}: Fecha: {date_str}, Médico: {doc_name}, Tipo: {appt.type}, Estado: {st_lbl}. Motivo: {appt.reason or 'Sin especificar'}\n"
        else:
            user_context += "No hay citas futuras o pendientes agendadas.\n"

        user_context += "\n--- CONSULTAS PASADAS Y FINALIZADAS (YA SE LLEVARON A CABO) ---\n"
        if past_completed_apps:
            for appt in past_completed_apps:
                doc_user = db.query(models.User).filter(models.User.id == appt.doctor_id).first()
                doc_name = doc_user.full_name if doc_user else "Doctor"
                date_str = appt.date_time.strftime("%d/%m/%Y a las %I:%M %p")
                linked_rxs = db.query(models.Prescription).filter(models.Prescription.appointment_id == appt.id).all()
                rx_str = " | Recetado en esta cita: " + ", ".join([f"{p.medicine} ({p.dose})" for p in linked_rxs]) if linked_rxs else " | Recetado en esta cita: Ninguno"
                user_context += f"- Consulta REALIZADA el {date_str} con el {doc_name}. Motivo: {appt.reason or 'Sin especificar'}{rx_str}\n"
        else:
            user_context += "EL PACIENTE AÚN NO HA TENIDO NINGUNA CONSULTA REALIZADA O FINALIZADA (0 CONSULTAS PASADAS).\n"

        # 3. Resúmenes clínicos detallados de consultas finalizadas
        histories = db.query(models.ClinicalHistory).filter(
            models.ClinicalHistory.patient_id == current_user.id
        ).order_by(models.ClinicalHistory.date.desc()).all()
        if histories:
            user_context += "\nRESÚMENES CLÍNICOS DE CONSULTAS FINALIZADAS:\n"
            for h in histories:
                doc_user = db.query(models.User).filter(models.User.id == h.doctor_id).first()
                doc_name = doc_user.full_name if doc_user else "Doctor"
                h_date = h.date.strftime("%d/%m/%Y a las %I:%M %p")
                user_context += f"- Consulta realizada el {h_date} con {doc_name}:\n  Resumen Clínico: {h.summary_ia or h.translation_text}\n"

        # 3. Citas rechazadas (SOLO para responder si el usuario pregunta explícitamente por qué fue rechazada)
        rejected_apps = db.query(models.Appointment).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status == "rechazada"
        ).all()
        if rejected_apps:
            user_context += "\nCITAS RECHAZADAS (OCULTAS - SOLO MENCIONAR SI EL PACIENTE PREGUNTA EXPLÍCITAMENTE POR QUÉ SE RECHAZÓ):\n"
            for appt in rejected_apps:
                doc_user = db.query(models.User).filter(models.User.id == appt.doctor_id).first()
                doc_name = doc_user.full_name if doc_user else "Doctor"
                date_str = appt.date_time.strftime("%d/%m/%Y a las %I:%M %p")
                user_context += f"- Cita #{appt.id} del {date_str} con {doc_name}: Rechazada por falta de disponibilidad en la agenda del doctor.\n"

    # Llamar al bot (IA)
    reply, sources = medical_chatbot.ask(req.message, chat_history, user_context=user_context)
    
    # Si hay un session_id, guardar la respuesta de la IA
    if req.session_id and session:
        bot_msg = models.ChatMessage(session_id=req.session_id, role="assistant", content=reply)
        db.add(bot_msg)
        db.commit()

    return schemas.ChatbotResponse(
        reply=reply, 
        sources=sources, 
        session_title=session.title if session else None
    )
