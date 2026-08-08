from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from typing import Dict, List, Set, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.file_store import append_to_store, read_store, clear_store, update_dict_store, read_dict_store
from app.routers.auth import get_current_user
from app import models
import os
import json
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/realtime", tags=["realtime_websockets"])

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> list of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()
        self.active_connections[room_id].add(websocket)
        logger.info(f"Nuevo cliente WebSocket conectado a la sala '{room_id}'")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        logger.info(f"Cliente WebSocket desconectado de la sala '{room_id}'")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_room(self, message: dict, room_id: str, exclude_websocket: WebSocket = None):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        # Limpiar conexión fallida si ocurre error al transmitir
                        logger.error(f"Error transmitiendo por WebSocket: {e}")
                        pass

manager = ConnectionManager()

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """
    WebSocket para coordinar la teleconsulta médica, señalización WebRTC y notificaciones.
    El cliente puede enviar mensajes para señalización o enviar gestos en tiempo real.
    """
    await manager.connect(websocket, room_id)
    try:
        while True:
            # Esperar mensajes entrantes en formato JSON
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                # Si no es JSON, enviarlo de vuelta como texto plano de error
                await websocket.send_json({"error": "Mensaje debe estar en formato JSON válido"})
                continue
            
            action = message.get("action")
            
            # --- Casos de Señalización WebRTC (PeerJS / LiveKit Client) ---
            if action in ["offer", "answer", "candidate", "signal"]:
                # Reenviar señal WebRTC al otro participante de la videollamada
                await manager.broadcast_to_room(message, room_id, exclude_websocket=websocket)
                
            # --- Caso de Gestos / Señas LSE en tiempo real ---
            elif action == "live_gesture":
                # Paciente envía una seña clasificada
                # Se transmite al médico de la sala para que aparezca en su pantalla como subtítulo
                gestures = message.get("gestures", [])
                from app.services.sign_translator import sign_translator_service
                
                # Traducir los gestos usando el servicio
                translation = sign_translator_service.translate_to_clinical_sentence(gestures)
                
                payload = {
                    "action": "live_translation",
                    "gestures": gestures,
                    "translation": translation,
                    "timestamp": message.get("timestamp")
                }
                # Difundir a la sala
                await manager.broadcast_to_room(payload, room_id)
                
            # --- Caso de Notificaciones del Sistema ---
            elif action == "system_notification":
                # Difundir notificación de receta emitida o paciente entrando en espera
                await manager.broadcast_to_room(message, room_id)
                
            else:
                # Eco genérico para depuración
                await manager.broadcast_to_room(message, room_id, exclude_websocket=websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        # Notificar a otros en la sala que un par se ha desconectado
        await manager.broadcast_to_room(
            {"action": "peer_disconnected", "message": "Un participante ha abandonado la sala."},
            room_id
        )

# Gestor de Sesiones de Teleconsulta Persistente en Backend (FastAPI)
# Mantiene el tiempo de llamada (start_time/elapsed_seconds), presencia y estado de medios
import time
import calendar

def utc_dt_to_timestamp(dt) -> float:
    """Convierte un datetime local a Unix timestamp (float) correctamente.
    Como el servidor ahora usa hora local para todas las fechas,
    dt.timestamp() asume que dt es local y genera el timestamp correcto."""
    return float(dt.timestamp())

room_media_store: Dict[str, Dict[str, dict]] = {}

def get_or_create_session(room_id: str) -> dict:
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    session = read_dict_store("sessions", clean_room)
    if not session:
        session = {
            "room_id": clean_room,
            "start_time": 0.0,
            "status": "active",
            "doctor_time": 0.0,
            "patient_time": 0.0
        }
        update_dict_store("sessions", clean_room, "status", "active")
        update_dict_store("sessions", clean_room, "start_time", 0.0)
        update_dict_store("sessions", clean_room, "doctor_time", 0.0)
        update_dict_store("sessions", clean_room, "patient_time", 0.0)
    return session

def resolve_start_time(session: dict, room_id: str, db) -> float:
    """Obtiene el start_time correcto. Si la sesión en memoria tiene 0,
    intenta leer el real_start_time de la base de datos (por si se reinició el servidor)."""
    
    if session.get("start_time", 0.0) > 0:
        return session["start_time"]

    # Intento de recuperación desde la BD
    try:
        appt = db.query(models.Appointment).filter(models.Appointment.id == int(room_id)).first()
        if appt and appt.real_start_time:
            ts = utc_dt_to_timestamp(appt.real_start_time)
            update_dict_store("sessions", room_id, "start_time", ts)
            return ts
    except Exception:
        pass
    
    return 0.0

@router.post("/start-timer/{room_id}")
def start_room_timer(room_id: str, start_ts: float = 0.0, db: Session = Depends(get_db)):
    """Registra el inicio oficial de la reunión. Idempotente."""
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    session = get_or_create_session(clean_room)
    now = time.time()

    if session.get("start_time", 0.0) == 0.0:
        if start_ts > 0:
            session["start_time"] = start_ts
        else:
            try:
                appt = db.query(models.Appointment).filter(models.Appointment.id == int(clean_room)).first()
                if appt and appt.real_start_time:
                    session["start_time"] = utc_dt_to_timestamp(appt.real_start_time)
                else:
                    session["start_time"] = now
            except Exception:
                session["start_time"] = now
        update_dict_store("sessions", clean_room, "start_time", session["start_time"])

    return {
        "status": "ok",
        "start_time": session["start_time"],
        "server_time": now
    }

@router.post("/presence/{room_id}/{role}")
def update_room_presence(room_id: str, role: str, muted: bool = False, video_off: bool = False):
    now = time.time()
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    clean_role = "doctor" if role == "doctor" else "patient"
    
    session = get_or_create_session(clean_room)
    
    # Actualizar marca de tiempo según el rol
    if clean_role == "doctor":
        update_dict_store("sessions", clean_room, "doctor_time", now)
    else:
        update_dict_store("sessions", clean_room, "patient_time", now)
        
    if clean_room not in room_media_store:
        room_media_store[clean_room] = {}
        
    room_media_store[clean_room][clean_role] = {
        "muted": muted,
        "videoOff": video_off,
        "updated_at": now
    }
    
    # Verificar conexión del interlocutor (últimos 6 segundos)
    counterpart = "patient" if clean_role == "doctor" else "doctor"
    spec_time = session.get(f"{counterpart}_time", 0)
    is_connected = (now - spec_time) < 6.0
    
    counterpart_media = room_media_store[clean_room].get(counterpart, {"muted": False, "videoOff": False})
    st = session["start_time"]
    elapsed_seconds = int(now - st) if st > 0 else 0

    return {
        "connected": is_connected,
        "doctor_online": (now - session.get("doctor_time", 0)) < 6.0,
        "patient_online": (now - session.get("patient_time", 0)) < 6.0,
        "start_time": st,
        "server_time": now,
        "elapsed_seconds": max(0, elapsed_seconds),
        "status": session.get("status", "active"),
        "counterpart_muted": counterpart_media.get("muted", False),
        "counterpart_video_off": counterpart_media.get("videoOff", False)
    }

@router.get("/presence/{room_id}")
def get_room_presence(room_id: str, db: Session = Depends(get_db)):
    now = time.time()
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    session = get_or_create_session(clean_room)

    doc_time = session.get("doctor_time", 0)
    pat_time = session.get("patient_time", 0)
    # Resolver start_time desde BD si la sesión en memoria está vacía
    st = resolve_start_time(session, clean_room, db)
    elapsed_seconds = int(now - st) if st > 0 else 0

    return {
        "doctor_online": (now - doc_time) < 6.0,
        "patient_online": (now - pat_time) < 6.0,
        "connected": ((now - doc_time) < 6.0) and ((now - pat_time) < 6.0),
        "start_time": st,
        "server_time": now,
        "elapsed_seconds": max(0, elapsed_seconds),
        "status": session.get("status", "active")
    }

@router.post("/leave/{room_id}/{role}")
def leave_room_presence(room_id: str, role: str):
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    clean_role = "doctor" if role == "doctor" else "patient"
    update_dict_store("sessions", clean_room, f"{clean_role}_time", 0)
    return {"status": "ok", "message": f"{clean_role} abandonó la sala '{clean_room}'"}

@router.post("/end/{room_id}")
async def end_room_session(room_id: str):
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    update_dict_store("sessions", clean_room, "status", "ended")
    update_dict_store("sessions", clean_room, "ended_at", time.time())
    
    try:
        await manager.broadcast_to_room({"action": "end_call", "status": "completada"}, clean_room)
    except Exception as e:
        logger.warn(f"Error broadcasting end_call: {e}")

    # Limpiar estado en disco y en memoria para que no persista si se reutiliza el room_id
    clear_store("subtitles", clean_room)
    clear_store("comments", clean_room)
    clear_store("sessions", clean_room)
    room_media_store.pop(clean_room, None)
        
    return {"status": "ok", "message": f"Sesión de la sala '{clean_room}' finalizada exitosamente"}

@router.post("/reload-backend")
def reload_backend():
    import os
    logger.info("Solicitud de reinicio del backend recibida. Finalizando worker...")
    os._exit(0)

@router.post("/reset/{room_id}")
def reset_room_session(room_id: str):
    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"
    room_subtitles_store.pop(clean_room, None)
    room_comments_store.pop(clean_room, None)
    room_media_store.pop(clean_room, None)
    room_sessions_store.pop(clean_room, None)
    return {"status": "ok", "message": f"Estado de la sala '{clean_room}' purgado por completo"}

class LiveCommentPayload(BaseModel):
    sender: str
    role: str
    text: str
    time: str

@router.get("/comments/{room_id}")
def get_room_comments(room_id: str):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    return read_store("comments", clean_room)

@router.post("/comments/{room_id}")
def post_room_comment(room_id: str, payload: LiveCommentPayload):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    
    msg_dict = {
        "id": "auto",
        "sender": payload.sender,
        "role": payload.role,
        "text": payload.text,
        "time": payload.time
    }
    
    updated_data = append_to_store("comments", clean_room, msg_dict)
    return {"status": "ok", "comments": updated_data}

# Subtítulos Persistentes por Sala
class SubtitlePayload(BaseModel):
    speaker_name: str
    speaker_role: str
    speaker_avatar: str = ""
    text: str
    timestamp: str

@router.get("/subtitles/{room_id}")
def get_room_subtitles(room_id: str):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    return read_store("subtitles", clean_room)

@router.post("/subtitles/{room_id}")
def post_room_subtitle(room_id: str, payload: SubtitlePayload):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    
    sub_dict = {
        "id": "auto",
        "speaker_name": payload.speaker_name,
        "speaker_role": payload.speaker_role,
        "speaker_avatar": payload.speaker_avatar,
        "text": payload.text,
        "timestamp": payload.timestamp
    }
    
    updated_data = append_to_store("subtitles", clean_room, sub_dict)
    return {"status": "ok", "subtitles": updated_data}

try:
    from livekit.api import AccessToken, VideoGrants
except ImportError:
    pass

@router.get("/livekit-token/{room_id}")
def get_livekit_token(
    room_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = os.environ.get("LIVEKIT_API_KEY", "devkey")
    api_secret = os.environ.get("LIVEKIT_API_SECRET", "mi_super_secreto_largo_para_livekit_de_32_letras")

    grant = VideoGrants(room_join=True, room=room_id)
    user_identity = f"{current_user.email}_{current_user.role}_{current_user.id}"
    access_token = AccessToken(api_key, api_secret)
    access_token = access_token.with_identity(user_identity).with_name(current_user.full_name).with_grants(grant)
    token_str = access_token.to_jwt()

    clean_room = room_id if room_id and room_id != "undefined" and room_id != "null" else "global"

    # Limpiar sesiones finalizadas
    session_data = read_dict_store("sessions", clean_room)
    if session_data and session_data.get("status") == "ended":
        clear_store("subtitles", clean_room)
        clear_store("comments", clean_room)
        clear_store("sessions", clean_room)

    session = get_or_create_session(clean_room)
    now = time.time()

    # FUENTE DE VERDAD PERMANENTE: leer real_start_time de la BD.
    # Esto garantiza que el timer sobreviva reinicios del backend y recargas de página.
    start_time_to_return = 0.0
    if clean_room.isdigit():
        try:
            appt = db.query(models.Appointment).filter(models.Appointment.id == int(clean_room)).first()
            if appt and appt.status == "en_curso" and appt.real_start_time:
                # FUENTE DE VERDAD: usar UTC timestamp correcto desde la BD
                start_time_to_return = utc_dt_to_timestamp(appt.real_start_time)
                # Sincronizar sesión en memoria
                if session["start_time"] == 0.0:
                    session["start_time"] = start_time_to_return
        except Exception:
            pass
    else:
        start_time_to_return = session["start_time"]

    return {
        "token": token_str,
        "start_time": start_time_to_return,
        "server_time": now
    }
