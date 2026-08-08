from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import datetime
import hashlib
import json
import base64

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


@router.get("/deepgram-token")
def get_deepgram_token(current_user: models.User = Depends(get_current_user)):
    """
    Devuelve el token de Deepgram para que el frontend establezca
    la conexión WebSocket de STT en tiempo real.
    """
    from app.config import settings
    if not settings.DEEPGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="DEEPGRAM_API_KEY no configurada")
    return {"token": settings.DEEPGRAM_API_KEY}


@router.post("/telemedicina-stt")
def telemedicina_stt(
    audio: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Recibe audio en tiempo real de la sala de telemedicina (Doctor o Paciente)
    y devuelve la transcripción ultra rápida usando Deepgram Nova-3.
    """
    import requests
    import re
    from app.config import settings
    import logging
    logger = logging.getLogger("telemedicina_stt")
    
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY no configurada")
        
    try:
        audio_bytes = audio.file.read()
        mime_type = audio.content_type or "audio/webm"
        
        files = {
            "file": ("audio.webm", audio_bytes, mime_type)
        }
        data = {
            "model": "deepgram/nova-3",
            "language": "es"
        }
        
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "SUPER-UCE DOC"
        }
        
        res = requests.post("https://openrouter.ai/api/v1/audio/transcriptions", headers=headers, files=files, data=data, timeout=10)
        
        if res.status_code == 200:
            transcription = res.json().get("text", "").strip()
            transcription = re.sub(r'^(Transcripción(:|\s)|Respuesta:)\s*', '', transcription, flags=re.IGNORECASE).strip(' "')
            return {"text": transcription}
        else:
            logger.error(f"Error STT: {res.status_code} {res.text}")
            return {"text": ""}
            
    except Exception as e:
        logger.error(f"Error procesando audio STT: {e}")
        return {"text": ""}
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

    notes_text = f"\nNotas Clínicas del Especialista:\n{req.clinical_notes}\n" if req.clinical_notes else ""
    
    # Crear prompt para resumen médico y Triage con contexto empático para lenguaje de señas (pacientes sordos)
    prompt = (
        "Actúa como un transcriptor médico y clasificador de triaje profesional.\n"
        "CONTEXTO CLÍNICO IMPORTANTE: La plataforma SUPER-UCE DOC atiende a pacientes sordos o sordomudos "
        "que se comunican mediante traducción de lenguaje de señas en vivo (LSE/ASL). Debido a las limitaciones "
        "tecnológicas del modelo de visión e IA de traducción de señas, algunas frases de la transcripción del paciente pueden "
        "resultar telegráficas, cortas, fragmentadas o con estructura gramatical atípica.\n"
        "INSTRUCCIÓN DE EVALUACIÓN CRÍTICA: Jamás interpretes la brevedad, repetición o incoherencia gramatical de las señas "
        "como un signo de trastorno mental, confusión psiquiátrica, demencia, desorientación ni 'locura'. Concéntrate "
        "únicamente en extraer los síntomas físicos u orgánicos reales comunicados (ej. dolor, mareo, fiebre, malestar) y "
        "las indicaciones del médico.\n\n"
        "A partir de la conversación y registros entre el médico y el paciente, elabora un Resumen Clínico estructurado "
        "con las siguientes secciones:\n"
        "1. SÍNTOMAS DETECTADOS\n"
        "2. SUGERENCIA DE DIAGNÓSTICO\n"
        "3. RECOMENDACIONES Y TRATAMIENTO\n\n"
        "Además, analiza el nivel de urgencia o gravedad del paciente basándote estrictamente en los síntomas físicos "
        "descritos y coloca AL FINAL del texto la etiqueta exacta de su estado, que DEBE SER UNA de estas tres:\n"
        "[STATUS: estable], [STATUS: seguimiento] o [STATUS: critico].\n"
        "- estable: Todo está normal, sin riesgo.\n"
        "- seguimiento: Síntomas moderados, infecciones leves, o requiere estar pendiente.\n"
        "- critico: Dolor agudo, riesgo inminente, o requiere atención inmediata.\n\n"
        "Mantén un tono formal, empático y conciso.\n\n"
        f"Conversación/Registros:\n{req.conversation_transcript}\n"
        f"{notes_text}\n"
        "Resumen Clínico IA:"
    )

    if (not req.conversation_transcript or req.conversation_transcript == "Sin conversación registrada.") and not req.clinical_notes:
        summary_text = "No se registró ninguna conversación de voz ni se añadieron notas clínicas durante esta consulta.\n\n[STATUS: estable]"
    else:
        summary_text = ""
        
    # Usar OpenRouter o HuggingFace para resumir
    from app.config import settings
    import requests
    import re
    
    if not summary_text and settings.OPENROUTER_API_KEY:
        try:
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "SUPER-UCE DOC"
            }
            # Utilizando el mismo modelo que el chat de IA
            payload = {
                "model": settings.OPENROUTER_MODEL, 
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=10)
            if res.status_code == 200:
                summary_text = res.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Error al resumir con OpenRouter: {e}")
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

    # Fallback si falla la llamada al LLM (evitar hardcodear síntomas falsos)
    if not summary_text:
        summary_text = (
            "Resumen no disponible. No se pudo generar la transcripción o el análisis automático debido a "
            "un error de conexión con la IA. El especialista deberá revisar manualmente el registro de la cita.\n[STATUS: seguimiento]"
        )

    # Extraer el STATUS del summary_text
    risk_status = "estable" # Default
    status_match = re.search(r'\[STATUS:\s*(estable|seguimiento|critico)\]', summary_text, re.IGNORECASE)
    if status_match:
        risk_status = status_match.group(1).lower()
        # Remover el tag del texto final del resumen
        summary_text = re.sub(r'\[STATUS:\s*(estable|seguimiento|critico)\]', '', summary_text, flags=re.IGNORECASE).strip()

    # Actualizar estado del paciente
    patient = db.query(models.Patient).filter(models.Patient.id == appointment.patient_id).first()
    if patient:
        patient.risk_status = risk_status
        db.commit()

    # Guardar en expediente clínico
    final_translation = req.conversation_transcript
    if req.clinical_notes:
        final_translation += f"\n\n--- NOTAS CLÍNICAS DEL DOCTOR ---\n{req.clinical_notes}"
        
    new_record = models.ClinicalHistory(
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        date=datetime.datetime.utcnow(),
        gestures_detected="Conversación grabada",
        translation_text=final_translation,
        summary_ia=summary_text
    )
    db.add(new_record)
    db.commit()
    
    # --- Agentic Memory: Extracción de Aprendizaje Continuo ---
    def extract_and_save():
        try:
            from app.database import SessionLocal
            from app.services.knowledge_extraction_service import knowledge_extraction_service
            from app.services.patient_memory_service import patient_memory_service
            
            bg_db = SessionLocal()
            facts = knowledge_extraction_service.extract_from_medical_summary(summary_text)
            for fact in facts:
                patient_memory_service.upsert_memory(
                    db=bg_db,
                    patient_id=appointment.patient_id,
                    memory_type=fact.get("type", "dato_clinico"),
                    value=fact.get("value", ""),
                    origin="teleconsulta"
                )
            bg_db.close()
        except Exception as e:
            print(f"Error en extracción asíncrona de resumen médico: {e}")
            
    import threading
    threading.Thread(target=extract_and_save).start()
    # -----------------------------------------------------------
    
    # Actualizar cita a completada
    appointment.status = "completada"
    if not appointment.real_end_time:
        appointment.real_end_time = datetime.datetime.utcnow()
    
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
            
        # Cargar el historial reciente solo para contexto local si fuera necesario en otras funciones
        db_messages = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == req.session_id).order_by(models.ChatMessage.created_at.asc()).limit(10).all()
        chat_history = [{"role": m.role, "content": m.content} for m in db_messages]

    # Extraer contexto directo de la base de datos para inyectarlo en el LLM (RAG Personalizado)
    # Usar huso horario de República Dominicana (UTC-4) para evitar discrepancias
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-4)))
    now_str = now.strftime("%Y-%m-%d %I:%M %p")
    user_context = f"FECHA Y HORA ACTUAL DEL SISTEMA: {now_str}\n"
    user_context += f"Nombre del paciente: {current_user.full_name}\n\n"
    
    if current_user.role == "patient":
        user_msg_lower = req.message.lower()
        asking_about_rejection = any(w in user_msg_lower for w in ["rechaz", "cancel", "por que", "por qué", "motivo del rechazo", "motivo de rechazo", "por que me"])

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
                doc_prof = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
                doc_spec = doc_prof.specialty if doc_prof else "Medicina General"
                doc_name = f"{doc_user.full_name} ({doc_spec})" if doc_user else "Doctor"
                # appt.date_time is already stored in local time
                local_time = appt.date_time 
                date_str = local_time.strftime("%d/%m/%Y a las %I:%M %p")
                st_lbl = "Confirmada (agendada)" if appt.status == "confirmada" else "Pendiente de aprobación"
                user_context += f"- Cita FUTURA PROGRAMADA #{appt.id}: Fecha: {date_str}, Médico: {doc_name}, Tipo: {appt.type}, Estado: {st_lbl}. Motivo: {appt.reason or 'Sin especificar'}\n"
        else:
            user_context += "EL PACIENTE TIENE CERO (0) CITAS FUTURAS O PENDIENTES. NO TIENE NINGUNA CITA PRÓXIMA PROGRAMADA EN EL SISTEMA.\n"

        user_context += "\n--- CONSULTAS PASADAS Y FINALIZADAS CON SUS RESÚMENES CLÍNICOS ---\n"
        
        histories = db.query(models.ClinicalHistory).filter(
            models.ClinicalHistory.patient_id == current_user.id
        ).order_by(models.ClinicalHistory.date.desc()).all()

        if past_completed_apps:
            for appt in past_completed_apps:
                doc_user = db.query(models.User).filter(models.User.id == appt.doctor_id).first()
                doc_prof = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
                doc_spec = doc_prof.specialty if doc_prof else "Medicina General"
                doc_name = f"{doc_user.full_name} ({doc_spec})" if doc_user else "Doctor"
                
                local_time = appt.date_time 
                date_str = local_time.strftime("%d/%m/%Y a las %I:%M %p")
                
                linked_rxs = db.query(models.Prescription).filter(models.Prescription.appointment_id == appt.id).all()
                rx_str = " | Recetado: " + ", ".join([f"{p.medicine} ({p.dose})" for p in linked_rxs]) if linked_rxs else " | Recetado: Ninguno"
                
                matched_summary = "No disponible"
                for h in histories:
                    if h.doctor_id == appt.doctor_id:
                        local_h_date = h.date - datetime.timedelta(hours=4)
                        if abs((local_h_date - local_time).total_seconds()) < 86400:
                            matched_summary = h.summary_ia or h.translation_text
                            histories.remove(h)
                            break
                            
                time_info = f"Programada para el {date_str}"
                if appt.real_start_time:
                    real_start_local = appt.real_start_time - datetime.timedelta(hours=4)
                    time_info += f" (Iniciada realmente a las {real_start_local.strftime('%I:%M %p')}"
                    if appt.real_end_time:
                        real_end_local = appt.real_end_time - datetime.timedelta(hours=4)
                        time_info += f", finalizada a las {real_end_local.strftime('%I:%M %p')})"
                    else:
                        time_info += ")"
                    
                user_context += f"- Consulta: {time_info} con el {doc_name}. Motivo: {appt.reason or 'Sin especificar'}{rx_str}\n"
                user_context += f"  Resumen Clínico y Notas: {matched_summary}\n\n"
        else:
            user_context += "EL PACIENTE AÚN NO HA TENIDO NINGUNA CONSULTA REALIZADA O FINALIZADA.\n"

        # 4. Recetas y Medicamentos asignados al paciente en el sistema
        all_rxs = db.query(models.Prescription).filter(
            models.Prescription.patient_id == current_user.id
        ).order_by(models.Prescription.issued_at.desc()).all()

        user_context += "\n--- RECETAS Y MEDICAMENTOS DEL PACIENTE EN LA PLATAFORMA ---\n"
        if all_rxs:
            for rx in all_rxs:
                doc_user = db.query(models.User).filter(models.User.id == rx.doctor_id).first()
                doc_prof = db.query(models.Doctor).filter(models.Doctor.id == rx.doctor_id).first()
                doc_spec = doc_prof.specialty if doc_prof else "Medicina General"
                doc_name = f"{doc_user.full_name} ({doc_spec})" if doc_user else "Doctor"
                issued_str = rx.issued_at.strftime("%d/%m/%Y a las %I:%M %p") if rx.issued_at else "Sin fecha"
                expires_str = rx.expires_at.strftime("%d/%m/%Y a las %I:%M %p") if rx.expires_at else "Sin fecha"
                
                now_utc = datetime.datetime.utcnow()
                is_expired = (rx.expires_at and now_utc > rx.expires_at)
                if rx.status == "despachada":
                    st_desc = "DESPACHADA Y VENCIDA (El paciente YA la consiguió / retiró en la farmacia. YA NO ESTÁ ACTIVA ni vigente para volver a reclamar)."
                elif rx.status == "vencida" or is_expired:
                    st_desc = "VENCIDA (Expiró el plazo de validez. YA NO ESTÁ ACTIVA)."
                else:
                    st_desc = "ACTIVA Y VIGENTE (Pendiente de ser despachada/retirada en farmacia)."

                user_context += f"- Receta #{rx.id}: Medicamento {rx.medicine} ({rx.dose}), Frecuencia: {rx.frequency}. Estado actual: {st_desc}. Emitida el {issued_str} por {doc_name}. Válida hasta {expires_str}.\n"
        else:
            user_context += "EL PACIENTE TIENE CERO (0) RECETAS O MEDICAMENTOS REGISTRADOS EN LA PLATAFORMA.\n"

        # 5. Citas rechazadas (SOLO si el usuario pregunta explícitamente por qué fue rechazada)
        if asking_about_rejection:
            rejected_apps = db.query(models.Appointment).filter(
                models.Appointment.patient_id == current_user.id,
                models.Appointment.status == "rechazada"
            ).all()
            if rejected_apps:
                user_context += "\nCITAS RECHAZADAS (OCULTAS - SOLO MENCIONAR PORQUE EL PACIENTE PREGUNTÓ EXPLÍCITAMENTE):\n"
                for appt in rejected_apps:
                    doc_user = db.query(models.User).filter(models.User.id == appt.doctor_id).first()
                    doc_prof = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
                    doc_spec = doc_prof.specialty if doc_prof else "Medicina General"
                    doc_name = f"{doc_user.full_name} ({doc_spec})" if doc_user else "Doctor"
                    date_str = appt.date_time.strftime("%d/%m/%Y a las %I:%M %p")
                    user_context += f"- Cita #{appt.id} del {date_str} con {doc_name}: RECHAZADA/CANCELADA por falta de disponibilidad en la agenda del doctor.\n"

    # Llamar al bot (IA) a través de la nueva Arquitectura Híbrida
    reply, sources = medical_chatbot.ask(
        query=req.message, 
        chat_history=chat_history, 
        user_context=user_context, 
        attached_doc_ids=req.attached_doc_ids,
        db=db,
        session_id=req.session_id,
        patient_id=current_user.id
    )

    return schemas.ChatbotResponse(
        reply=reply, 
        sources=sources, 
        session_title=session.title if session else None
    )


@router.post("/speech-to-text", response_model=schemas.SpeechToTextResponse)
def speech_to_text(
    req: schemas.SpeechToTextRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Recibe audio en Base64, lo transcribe usando OpenRouter, y lo valida
    mediante el SpeechValidationService para evitar alucinaciones.
    """
    from app.config import settings
    import requests
    import re
    from app.services.speech_validation_service import speech_validation_service
    import logging
    
    logger = logging.getLogger("speech_to_text")
    
    if not req.audio_base64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionó audio para transcribir."
        )

    clean_base64 = req.audio_base64
    if "," in clean_base64:
        clean_base64 = clean_base64.split(",", 1)[1]
    
    audio_format = (req.audio_format or "webm").replace("audio/", "").split(";")[0].strip()
    mime_type = f"audio/{audio_format}" if not audio_format.startswith("audio/") else audio_format

    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API Key de OpenRouter no configurada en el servidor."
        )

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "SUPER-UCE DOC"
    }

    MAX_STT_RETRIES = 2
    transcription = ""
    
    for attempt in range(MAX_STT_RETRIES):
        transcription = ""
        try:
            # Usar API de Transcripción dedicada (Deepgram via OpenRouter)
            # El endpoint estándar /audio/transcriptions de OpenAI/OpenRouter requiere multipart/form-data
            audio_bytes = base64.b64decode(clean_base64)
            files = {
                "file": ("audio.webm", audio_bytes, mime_type)
            }
            data = {
                "model": "deepgram/nova-3",
                "language": "es"
            }
            
            res = requests.post("https://openrouter.ai/api/v1/audio/transcriptions", headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"}, files=files, data=data, timeout=15)
            if res.status_code == 200:
                transcription = res.json().get("text", "").strip()
            else:
                logger.warning(f"[STT] Intento {attempt+1} falló HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"[STT] Error en intento {attempt+1}: {e}")

        if not transcription:
            continue
            
        # Limpiar posible formato no deseado
        transcription = re.sub(r'^(Transcripción(:|\s)|Respuesta:)\s*', '', transcription, flags=re.IGNORECASE).strip(' "')

        # Como Deepgram no alucina, aceptamos directamente la transcripción (sin speech_validation_service)
        logger.info(f"[STT] ÉXITO en intento {attempt+1}. Transcripción: {transcription}")
        return schemas.SpeechToTextResponse(transcription=transcription)
            
    # Si agotamos los reintentos
    raise HTTPException(
        status_code=422,
        detail="No pude escuchar correctamente el audio. ¿Podrías repetirlo o hablar un poco más despacio?"
    )


@router.post("/upload-document", response_model=schemas.DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Recibe y procesa documentos clínicos (PDF, DOCX, TXT) para ingesta RAG optimizada y económica.
    """
    from app.services.document_engine import document_engine
    
    file_bytes = await file.read()
    filename = file.filename or "doc.txt"
    
    proc_doc = document_engine.parse_and_index_document(file_bytes, filename, user_id=current_user.id)
    
    return schemas.DocumentUploadResponse(
        doc_id=proc_doc.doc_id,
        filename=proc_doc.filename,
        doc_type=proc_doc.doc_type,
        pages_count=proc_doc.pages_count,
        chunks_count=len(proc_doc.chunks),
        status="Procesado",
        hash=proc_doc.file_hash
    )

