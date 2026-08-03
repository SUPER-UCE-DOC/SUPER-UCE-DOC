import base64
import json
import time
import datetime
import os
import cv2
import collections
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import mediapipe as mp

import asyncio
from app.islr.model import IsolatedASLRecognition, Landmark, LandmarkData
from app.services.llm_translator import translate_signs_to_sentence

LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "islr_realtime_debug.log")

def log_islr_event(msg: str):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
    line = f"[{timestamp}] {msg}\n"
    print(line, end="")
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass

# Trigger reload for mediapipe version
router = APIRouter(prefix="/api/sign-language", tags=["islr"])

# ──────────────────────────────────────────────
# Configuración multi-hilos (Basado en test_model.py)
# ──────────────────────────────────────────────
TOTAL_CPU = os.cpu_count() or 4
AVAILABLE_THREADS = max(TOTAL_CPU - 4, 1)

# Configurar OpenCV para usar los hilos disponibles
cv2.setNumThreads(AVAILABLE_THREADS)
print(f"[ISLR] Iniciando con {AVAILABLE_THREADS} hilos para procesamiento de video (Total CPU: {TOTAL_CPU})")

# Cargar el modelo en memoria (Solo una vez para toda la app)
try:
    print("[ISLR] Cargando modelo ISLR...")
    traductor = IsolatedASLRecognition(model_path="app/islr")
    print("[ISLR] Modelo ISLR cargado exitosamente.")
except Exception as e:
    print(f"[ISLR] Error cargando modelo: {e}")
    traductor = None

def get_landmarks(landmark_list):
    """Convierte los landmarks de MediaPipe a la clase Landmark."""
    if not landmark_list:
        return None
    return [Landmark(x=lm.x, y=lm.y, z=lm.z, visibility=lm.visibility) for lm in landmark_list.landmark]

def decode_and_process_frame(frame_base64, holistic_model):
    """Decodifica Base64 y procesa con MediaPipe de forma síncrona (para usar en hilos)."""
    if "," in frame_base64:
        frame_base64 = frame_base64.split(",")[1]
    image_bytes = base64.b64decode(frame_base64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frame_rgb.flags.writeable = False
    return holistic_model.process(frame_rgb)

# Diccionario para gestionar las salas activas y evitar solapamientos
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/stream/{room_id}")
async def sign_language_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    active_connections[room_id] = websocket
    print(f"[ISLR] Cliente de seña conectado a sala {room_id}")

    # Inicializar MediaPipe Holistic
    mp_holistic = mp.solutions.holistic
    holistic = mp_holistic.Holistic(
        model_complexity=0, # Bajar complejidad para que sea en tiempo real (ultra-rápido)
        smooth_landmarks=True,
        refine_face_landmarks=False, # No necesitamos los labios/ojos en detalle para este modelo
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    landmark_buffer = collections.deque(maxlen=30)
    frame_count = 0
    start_time = time.time()
    last_predicted_count = 0

    WINDOW_SIZE = 20
    PREDICT_EVERY = 5
    
    websocket.word_buffer = []
    websocket.last_sign_time = time.time()
    websocket.is_translating = False
    websocket.translation_tasks = set()
    websocket.hands_detected = False

    async def _run_llm_translation(words_to_translate, original_timestamp=None):
        sentence = await translate_signs_to_sentence(words_to_translate)
        if sentence:
            try:
                payload = {
                    "type": "SENTENCE_PREDICTED",
                    "sentence": sentence
                }
                if original_timestamp:
                    payload["test_timestamp"] = original_timestamp
                await websocket.send_json(payload)
                print(f"[LLM] Traducción enviada: {sentence}")
            except Exception as e:
                print(f"[LLM] Error enviando traducción: {e}")
        websocket.is_translating = False

    try:
        while True:
            # Detectar pausa al final de una oración completa (3.5s continuos de inactividad tras la última seña)
            current_time = time.time()
            if len(websocket.word_buffer) > 0 and not websocket.is_translating:
                # El temporizador de oración depende únicamente del tiempo transcurrido desde la última seña confirmada (resiliente a parpadeos de MediaPipe)
                is_timeout = (current_time - websocket.last_sign_time) > 3.5
                is_silence = getattr(websocket, "silence_trigger", False)
                
                if is_timeout or is_silence:
                    websocket.is_translating = True
                    reason = "silence_trigger (No Movement Detected)" if is_silence else f"inactivity_timeout ({current_time - websocket.last_sign_time:.2f}s)"
                    log_islr_event(f"🚀 DISPARO TRADUCCIÓN UNIFICADA -> Causa: {reason} | Palabras acumuladas: {websocket.word_buffer}")
                    websocket.silence_trigger = False # Reset
                    words_copy = list(websocket.word_buffer)
                    websocket.word_buffer.clear() # Limpiar buffer para la próxima oración
                    websocket.last_sent_sign = ""
                    websocket.last_candidate_sign = ""
                    websocket.consecutive_count = 0
                    
                    test_timestamp = getattr(websocket, "last_test_timestamp", None)
                    websocket.last_test_timestamp = None
                    
                    task = asyncio.create_task(_run_llm_translation(words_copy, test_timestamp))
                    websocket.translation_tasks.add(task)
                    task.add_done_callback(websocket.translation_tasks.discard)

            # Recibir frame en base64 desde el frontend con timeout para no bloquear la detección de pausas
            try:
                data_json = await asyncio.wait_for(websocket.receive_text(), timeout=0.2)
            except asyncio.TimeoutError:
                continue # Volver a evaluar el bucle y la pausa
                
            data = json.loads(data_json)
            
            if data.get("type") == "GLOSS_INJECT":
                # Endpoint de prueba para inyectar glosas saltando MediaPipe
                injected_sign = data.get("sign")
                timestamp = data.get("timestamp")
                if injected_sign:
                    if injected_sign == "No Movement Detected":
                        if len(websocket.word_buffer) > 0:
                            websocket.silence_trigger = True
                    else:
                        websocket.word_buffer.append(injected_sign)
                        websocket.last_sign_time = time.time()
                        # Si nos envían un timestamp original, lo guardamos para pasarlo en la respuesta
                        if timestamp:
                            websocket.last_test_timestamp = timestamp
                continue
                
            if data.get("type") != "FRAME" or not traductor:
                continue
                
            frame_base64 = data.get("frame")
            if not frame_base64:
                continue

            # Ejecutar decodificación y MediaPipe en un hilo de fondo para no bloquear el Event Loop de FastAPI
            try:
                results = await asyncio.to_thread(decode_and_process_frame, frame_base64, holistic)
            except Exception as e:
                print(f"[ISLR] Error procesando imagen en MediaPipe: {e}")
                continue
            
            websocket.hands_detected = bool(results.left_hand_landmarks or results.right_hand_landmarks)
            
            frame_count += 1
            time_in_sec = time.time() - start_time
            
            # Formatear datos para el modelo
            lm_data = LandmarkData(
                timeInSeconds=time_in_sec,
                frameNumber=frame_count,
                poseLandmarks=get_landmarks(results.pose_landmarks),
                faceLandmarks=get_landmarks(results.face_landmarks),
                leftHandLandmarks=get_landmarks(results.left_hand_landmarks),
                rightHandLandmarks=get_landmarks(results.right_hand_landmarks)
            )
            
            landmark_buffer.append(lm_data)
            
            # Evaluar predicción
            if len(landmark_buffer) >= WINDOW_SIZE and (frame_count - last_predicted_count) >= PREDICT_EVERY:
                window = list(landmark_buffer)[-WINDOW_SIZE:]
                
                # Regla de calidad: Al menos 40% de los frames deben tener manos
                hands_detected = sum(1 for d in window if d.leftHandLandmarks or d.rightHandLandmarks)
                
                if hands_detected >= (WINDOW_SIZE * 0.4):
                    try:
                        res = traductor.predict(window)
                        # Filtro de repeticiones y umbral de confianza en el backend
                        if res and "sign" in res and res["sign"]:
                            current_sign = res["sign"]
                            confidence = res.get("confidence", 1.0)
                            
                            if current_sign == "No Movement Detected":
                                log_islr_event(f"🛑 NO MOVEMENT DETECTED | Buffer actual: {getattr(websocket, 'word_buffer', [])}")
                                # Detectar silencio explícito para enviar el buffer rápidamente
                                if hasattr(websocket, "word_buffer") and len(websocket.word_buffer) > 0:
                                    websocket.silence_trigger = True
                                # Resetear contador por silencio
                                websocket.last_candidate_sign = ""
                                websocket.consecutive_count = 0
                            
                            # Filtro estricto: Softmax > 0.60 y excluir señas de descarte
                            elif current_sign not in ["", "jeans"] and confidence > 0.60:
                                
                                # 1. Estabilidad Temporal
                                if current_sign == getattr(websocket, "last_candidate_sign", ""):
                                    websocket.consecutive_count += 1
                                else:
                                    websocket.last_candidate_sign = current_sign
                                    websocket.consecutive_count = 1
                                    
                                # 2. Confirmación y Debounce (2 ventanas)
                                if websocket.consecutive_count >= 2:
                                    if current_sign != getattr(websocket, "last_sent_sign", ""):
                                        websocket.last_sent_sign = current_sign
                                        websocket.word_buffer.append(current_sign)
                                        websocket.last_sign_time = time.time()
                                        
                                        log_islr_event(f"✅ SEÑA CONFIRMADA: '{current_sign}' ({confidence*100:.1f}%) | Buffer acumulado: {websocket.word_buffer}")
                                        
                                        # Enviar resultado parcial (palabra) al paciente
                                        await websocket.send_json({
                                            "type": "SIGN_PREDICTED",
                                            "sign": current_sign,
                                            "confidence": float(confidence)
                                        })
                            else:
                                # Rompe la racha si baja la confianza o si es un sign descartado
                                websocket.last_candidate_sign = ""
                                websocket.consecutive_count = 0
                                print(f"[ISLR] Predicción añadida al buffer: {current_sign} ({confidence*100:.1f}%)")
                    except Exception as e:
                        print(f"[ISLR] Error en predicción: {e}")
                
                # Después de una predicción exitosa o fallida (si se evaluó), saltamos frames para evitar superposición excesiva
                last_predicted_count = frame_count

    except WebSocketDisconnect:
        print(f"[ISLR] Cliente desconectado de sala {room_id}")
    except Exception as e:
        print(f"[ISLR] Error inesperado en WebSocket: {e}")
    finally:
        holistic.close()
        if room_id in active_connections:
            del active_connections[room_id]
