from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
import json
import logging

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

# Store room presence in memory
# room_presence_store = { room_id: { "doctor": timestamp, "patient": timestamp } }
import time
room_presence_store: Dict[str, Dict[str, float]] = {}

@router.post("/presence/{room_id}/{role}")
def update_room_presence(room_id: str, role: str):
    now = time.time()
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    clean_role = "doctor" if role == "doctor" else "patient"
    
    if clean_room not in room_presence_store:
        room_presence_store[clean_room] = {}
        
    room_presence_store[clean_room][clean_role] = now
    
    if "start_time" not in room_presence_store[clean_room]:
        room_presence_store[clean_room]["start_time"] = now

    # Check counterpart presence specifically in THIS room (within last 6 seconds)
    counterpart = "patient" if clean_role == "doctor" else "doctor"
    spec_time = room_presence_store[clean_room].get(counterpart, 0)
    is_connected = (now - spec_time) < 6.0
    
    return {
        "connected": is_connected,
        "doctor_online": (now - room_presence_store[clean_room].get("doctor", 0)) < 6.0,
        "patient_online": (now - room_presence_store[clean_room].get("patient", 0)) < 6.0,
        "start_time": room_presence_store[clean_room].get("start_time", now)
    }

@router.get("/presence/{room_id}")
def get_room_presence(room_id: str):
    now = time.time()
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    room = room_presence_store.get(clean_room, {})
    doc_time = room.get("doctor", 0)
    pat_time = room.get("patient", 0)
    
    if "start_time" not in room:
        if clean_room not in room_presence_store:
            room_presence_store[clean_room] = {}
        room_presence_store[clean_room]["start_time"] = now
        room = room_presence_store[clean_room]
        
    start_time = room.get("start_time", now)
    return {
        "doctor_online": (now - doc_time) < 6.0,
        "patient_online": (now - pat_time) < 6.0,
        "connected": ((now - doc_time) < 6.0) and ((now - pat_time) < 6.0),
        "start_time": start_time
    }

from pydantic import BaseModel

class LiveCommentPayload(BaseModel):
    sender: str
    role: str
    text: str
    time: str

room_comments_store: Dict[str, List[dict]] = {}

@router.get("/comments/{room_id}")
def get_room_comments(room_id: str):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    return room_comments_store.get(clean_room, [])

@router.post("/comments/{room_id}")
def post_room_comment(room_id: str, payload: LiveCommentPayload):
    clean_room = room_id if room_id and room_id != "undefined" else "global"
    if clean_room not in room_comments_store:
        room_comments_store[clean_room] = []
    
    msg_dict = {
        "sender": payload.sender,
        "role": payload.role,
        "text": payload.text,
        "time": payload.time
    }
    
    room_comments_store[clean_room].append(msg_dict)
    return {"status": "ok", "comments": room_comments_store[clean_room]}
