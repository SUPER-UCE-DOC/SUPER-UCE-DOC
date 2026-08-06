import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare,
  Captions, Hand, Send, Pill, FileText, Clock, CheckCircle2,
  User, ShieldCheck, Minimize2, Maximize2, MapPin, RefreshCw, GripHorizontal
} from "lucide-react";
import { api, getToken, API_BASE_URL } from "../utils/api";
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  useTrackToggle,
  useIsMuted,
  RoomAudioRenderer,
  useRoomContext,
  useDataChannel
} from "@livekit/components-react";
import { Track, RoomEvent, Participant } from "livekit-client";

interface TelemedicinaRoomProps {
  role: "doctor" | "patient";
  userName: string;
  userAvatar?: string;
  counterpartName: string;
  counterpartAvatar?: string;
  counterpartSpecialty?: string;
  patientId?: number;
  appointmentId?: number;
  appointmentReason?: string;
  onEndCall: () => void;
  onEmitRxSuccess?: () => void;
  isMinimized?: boolean;
  onReturnToCall?: () => void;
}

const ragMedicines = [
  { name: "Losartán 50mg", defaultDose: "1 comprimido cada 24 horas", defaultFreq: "Por 30 días" },
  { name: "Losartán 25mg", defaultDose: "1 comprimido cada 12 horas", defaultFreq: "Por 30 días" },
  { name: "Atorvastatina 20mg", defaultDose: "1 comprimido en la noche", defaultFreq: "Por 30 días" },
  { name: "Metformina 500mg", defaultDose: "1 comprimido con las comidas", defaultFreq: "Por 30 días" },
  { name: "Metformina 850mg", defaultDose: "1 comprimido dos veces al día", defaultFreq: "Por 30 días" },
  { name: "Omeprazol 20mg", defaultDose: "1 cápsula en ayunas", defaultFreq: "Por 14 días" },
  { name: "Paracetamol 500mg (Acetaminofén)", defaultDose: "1 comprimido cada 8 horas", defaultFreq: "Según dolor/fiebre (max 5 días)" },
  { name: "Amoxicilina 500mg", defaultDose: "1 cápsula cada 8 horas", defaultFreq: "Por 7 días" },
  { name: "Amoxicilina + Ác. Clavulánico 875mg", defaultDose: "1 comprimido cada 12 horas", defaultFreq: "Por 7 días" },
  { name: "Azitromicina 500mg", defaultDose: "1 comprimido al día", defaultFreq: "Por 3 días" },
  { name: "Ciprofloxacino 500mg", defaultDose: "1 comprimido cada 12 horas", defaultFreq: "Por 7 días" },
  { name: "Ibuprofeno 400mg", defaultDose: "1 comprimido cada 8 horas", defaultFreq: "Por 5 días" },
  { name: "Ibuprofeno 600mg", defaultDose: "1 comprimido cada 8 horas", defaultFreq: "Por 5 días" },
  { name: "Diclofenaco 50mg", defaultDose: "1 comprimido cada 12 horas", defaultFreq: "Por 5 días" },
  { name: "Enalapril 20mg", defaultDose: "1 comprimido cada 24 horas", defaultFreq: "Por 30 días" },
  { name: "Amlodipino 5mg", defaultDose: "1 comprimido al día", defaultFreq: "Por 30 días" },
  { name: "Amlodipino 10mg", defaultDose: "1 comprimido al día", defaultFreq: "Por 30 días" },
  { name: "Atenolol 50mg", defaultDose: "1 comprimido al día", defaultFreq: "Por 30 días" },
  { name: "Hidroclorotiazida 25mg", defaultDose: "1 comprimido en la mañana", defaultFreq: "Por 30 días" },
  { name: "Glibenclamida 5mg", defaultDose: "1 comprimido antes del desayuno", defaultFreq: "Por 30 días" },
  { name: "Sertralina 50mg", defaultDose: "1 comprimido en la mañana", defaultFreq: "Por 30 días" },
  { name: "Furosemida 40mg", defaultDose: "1 comprimido en la mañana", defaultFreq: "Por 30 días" },
  { name: "Ácido Fólico 5mg", defaultDose: "1 comprimido al día", defaultFreq: "Por 30 días" },
  { name: "Loratadina 10mg", defaultDose: "1 comprimido cada 24 horas", defaultFreq: "Por 10 días" },
  { name: "Sales de Rehidratación Oral (SRO)", defaultDose: "1 sobre disuelto en 1L de agua", defaultFreq: "Tomar a voluntad tras cada deposición" },
];

export function TelemedicinaRoom(props: TelemedicinaRoomProps) {
  const [tokenToUse, setTokenToUse] = useState<string>("");
  const [roomStartTime, setRoomStartTime] = useState<number>(0);
  const lastFetchedIdRef = useRef<string | null>(null);

  const roomAppId = props.appointmentId ? String(props.appointmentId) : "global";
  const joinKey = `has_joined_teleconsult_${roomAppId}`;

  // Pre-call Lobby State (Teams / Meet style)
  // - Doctors: use localStorage so the flag survives component remounts during PIP navigation.
  //   The flag is cleared ONLY when onEndCall is called (doctor explicitly ends the call).
  // - Patients: use sessionStorage to restore their active call state across sections.
  const doctorActiveKey = `doctor_in_active_call_${roomAppId}`;
  const [hasJoined, setHasJoinedState] = useState(() => {
    if (props.role === "doctor") {
      // Restore from localStorage: if doctor was already in this call, skip lobby
      return localStorage.getItem(doctorActiveKey) === "true";
    }
    return sessionStorage.getItem(joinKey) === "true";
  });
  const [joinedVideoOn, setJoinedVideoOn] = useState(true);
  const [joinedAudioOn, setJoinedAudioOn] = useState(true);
  const [joinedLsaOn, setJoinedLsaOn] = useState(true);

  const setHasJoined = (val: boolean) => {
    if (props.role === "doctor") {
      if (val) {
        localStorage.setItem(doctorActiveKey, "true");
      } else {
        localStorage.removeItem(doctorActiveKey);
      }
    } else {
      if (val) {
        sessionStorage.setItem(joinKey, "true");
      } else {
        sessionStorage.removeItem(joinKey);
      }
    }
    setHasJoinedState(val);
  };

  // Wrap onEndCall to clear the doctor active call flag before delegating up
  const handleEndCallWrapped = () => {
    if (props.role === "doctor") {
      localStorage.removeItem(doctorActiveKey);
    }
    props.onEndCall();
  };

  useEffect(() => {
    // Force sidebar collapse when entering live room
    sessionStorage.setItem("mainSidebarCollapsed", "true");
    window.dispatchEvent(new Event("force-sidebar-collapse"));

    const cleanupSidebar = () => {
      sessionStorage.setItem("mainSidebarCollapsed", "false");
      window.dispatchEvent(new Event("force-sidebar-expand"));
    };

    const targetRoomCode = props.appointmentId ? String(props.appointmentId) : "global";
    if (lastFetchedIdRef.current === targetRoomCode && tokenToUse) {
      return cleanupSidebar;
    }
    lastFetchedIdRef.current = targetRoomCode;

    const fetchToken = async () => {
      try {
        const res = await api.getLiveKitToken(targetRoomCode);
        setTokenToUse(res.token);
        if (res.start_time) {
          setRoomStartTime(res.start_time);
        }
      } catch (err) {
        console.error("Error fetching LiveKit token:", err);
        lastFetchedIdRef.current = null; // Allow retry on error
      }
    };
    fetchToken();

    return cleanupSidebar;
  }, [props.appointmentId]);

  const liveKitOptions = useMemo(() => ({
    adaptiveStream: true,
    dynacast: true,
    rtcConfig: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    }
  }), []);

  if (!tokenToUse) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-[#00A69D] border-t-transparent animate-spin"></div>
          <div className="text-sm font-bold text-[#203A70]">Conectando a la sala segura...</div>
        </div>
      </div>
    );
  }

  // Pre-Call Lobby Screen (Lobby previo a la llamada estilo Teams / Meet)
  if (!hasJoined) {
    return (
      <PreCallLobby
        props={{ ...props, onEndCall: handleEndCallWrapped }}
        onJoin={(videoOn, audioOn, lsaOn) => {
          setJoinedVideoOn(videoOn);
          setJoinedAudioOn(audioOn);
          setJoinedLsaOn(lsaOn);
          setHasJoined(true);
          // Actualizar estado de la cita a "en_curso" ÚNICAMENTE al unirse oficialmente desde el lobby
          if (props.appointmentId) {
            api.updateAppointmentStatus(props.appointmentId, "en_curso").catch((err) => {
              console.warn("Error actualizando estado de cita a en_curso:", err);
            });
          }
          props.onJoinCall?.();
        }}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={(import.meta as any).env?.VITE_LIVEKIT_URL || "wss://superucedoc-livekit.duckdns.org"}
      token={tokenToUse}
      connect={true}
      video={joinedVideoOn}
      audio={joinedAudioOn}
      options={liveKitOptions}
      className="h-full w-full"
    >
      <TelemedicinaRoomContent
        {...props}
        onEndCall={handleEndCallWrapped}
        startTime={roomStartTime}
        initialVideoOff={!joinedVideoOn}
        initialAudioMuted={!joinedAudioOn}
        initialLsaOn={joinedLsaOn}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ──────────────────────────────────────────────
// Componente de Menú Previo / Lobby estilo Microsoft Teams
// ──────────────────────────────────────────────
function PreCallLobby({
  props,
  onJoin
}: {
  props: TelemedicinaRoomProps;
  onJoin: (videoOn: boolean, audioOn: boolean, lsaOn: boolean) => void;
}) {
  const savedVideoOff = localStorage.getItem("local_video_off") === "true";
  const savedAudioMuted = localStorage.getItem("local_audio_muted") === "true";
  const savedLsaPref = localStorage.getItem("lsa_preference") !== "false";

  const [videoOn, setVideoOn] = useState(!savedVideoOff);
  const [audioOn, setAudioOn] = useState(!savedAudioMuted);
  const [lsaOn, setLsaOn] = useState(savedLsaPref);
  const [hasCameraDevice, setHasCameraDevice] = useState(true);
  const [hasMicDevice, setHasMicDevice] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detectar dispositivos de hardware al montar el Lobby
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const hasVideo = devices.some(d => d.kind === "videoinput");
      const hasAudio = devices.some(d => d.kind === "audioinput");
      setHasCameraDevice(hasVideo);
      setHasMicDevice(hasAudio);
      if (!hasVideo) setVideoOn(false);
      if (!hasAudio) setAudioOn(false);
    }).catch(() => {});
  }, []);

  // Previsualización local de la cámara en el Lobby
  useEffect(() => {
    if (!videoOn || !hasCameraDevice) {
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
        setPreviewStream(null);
      }
      return;
    }

    let active = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (active) {
          setPreviewStream(stream);
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      })
      .catch(err => {
        console.warn("Vista previa de cámara no disponible:", err);
        if (active) setVideoOn(false);
      });

    return () => {
      active = false;
    };
  }, [videoOn, hasCameraDevice]);

  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Limpiar stream al desmontar el lobby
  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [previewStream]);

  const handleJoinClick = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      setPreviewStream(null);
    }
    localStorage.setItem("local_video_off", !videoOn ? "true" : "false");
    localStorage.setItem("local_audio_muted", !audioOn ? "true" : "false");
    localStorage.setItem("lsa_preference", lsaOn ? "true" : "false");
    onJoin(videoOn, audioOn, lsaOn);
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-full w-full bg-[#F9FAFB] flex flex-col items-center justify-center p-6 md:p-10 overflow-y-auto relative font-sans">
      {/* Área Central: Vista Previa y Configuración de Entrada */}
      <div className="w-full max-w-6xl my-auto flex flex-col lg:flex-row items-stretch justify-center gap-8 py-4">
        {/* Columna Izquierda: Vista previa de cámara (Ampliada) */}
        <div className="flex-1 w-full bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col items-center justify-between gap-6">
          <div className="relative aspect-video min-h-[380px] md:min-h-[440px] w-full bg-[#111827] rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            {videoOn && hasCameraDevice && previewStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-3xl mb-3 shadow-md">
                  {props.userAvatar && (props.userAvatar.startsWith("http") || props.userAvatar.startsWith("data:")) ? (
                    <img src={props.userAvatar} alt={props.userName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    getInitials(props.userName)
                  )}
                </div>
                <h3 className="text-lg font-bold text-white">{props.userName} (Tú)</h3>
                {!audioOn && <span className="text-xs text-red-400 font-bold mt-1">Micrófono Desactivado</span>}
                {!videoOn && (
                  <span className="text-xs text-slate-400 font-medium mt-1">
                    {!hasCameraDevice ? "Sin cámara detectada" : "Cámara Desactivada"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Barra de Controles Dedicada (Debajo de la cámara, ampliada y sin cortes) */}
          <div className="flex items-center justify-center gap-4 py-3.5 px-6 bg-gray-50/80 rounded-2xl border border-gray-100 w-full flex-wrap">
            <button
              onClick={() => {
                if (!hasMicDevice) return;
                setAudioOn(!audioOn);
              }}
              disabled={!hasMicDevice}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                !hasMicDevice
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                  : !audioOn
                    ? "bg-red-50 text-red-600 border-red-200 cursor-pointer"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer"
              }`}
              title={!hasMicDevice ? "Sin micrófono detectado" : audioOn ? "Desactivar micrófono" : "Activar micrófono"}
            >
              {audioOn ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{!hasMicDevice ? "Sin micrófono" : audioOn ? "Micrófono Activado" : "Micrófono Desactivado"}</span>
            </button>

            <button
              onClick={() => {
                if (!hasCameraDevice) return;
                setVideoOn(!videoOn);
              }}
              disabled={!hasCameraDevice}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                !hasCameraDevice
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                  : !videoOn
                    ? "bg-red-50 text-red-600 border-red-200 cursor-pointer"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 cursor-pointer"
              }`}
              title={
                !hasCameraDevice
                  ? "Sin cámara detectada en este equipo"
                  : videoOn ? "Desactivar cámara" : "Activar cámara"
              }
            >
              <VideoOff size={18} className={!hasCameraDevice ? "text-gray-400" : !videoOn ? "text-red-600" : "text-gray-600"} />
              <span>{!hasCameraDevice ? "Sin cámara" : videoOn ? "Cámara Activada" : "Cámara Desactivada"}</span>
            </button>

            {props.role === "patient" && (
              <button
                onClick={() => setLsaOn(!lsaOn)}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border shadow-sm ${
                  lsaOn
                    ? "bg-[#F0FFFE] text-[#00A69D] border-[#CCFBF6]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
                title="Activar/Desactivar Traductor de Lenguaje de Señas (LSA)"
              >
                <Hand size={18} />
                <span>{lsaOn ? "Traductor LSA Activado" : "Traductor LSA Desactivado"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Ingreso e Información (Ampliada) */}
        <div className="w-full lg:w-[420px] bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col justify-between gap-6 flex-shrink-0">
          <div>
            <div className="inline-block px-3.5 py-1 rounded-full bg-teal-50 text-[#00A69D] font-bold text-xs mb-3 border border-teal-100">
              {props.role === "doctor" ? "Panel del Médico" : "Paciente"}
            </div>
            <h2 className="text-2xl font-bold text-[#203A70]">¿Listo para la consulta?</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              {props.role === "doctor"
                ? `Atención médica virtual con ${props.counterpartName}`
                : `Consulta médica con el ${props.counterpartName}`}
            </p>
          </div>

          {/* Tarjeta del Interlocutor (Paciente o Doctor Registrado) */}
          <div className="flex items-center gap-4 p-4.5 rounded-2xl bg-gray-50/90 border border-gray-100">
            <div className="w-14 h-14 rounded-full bg-[#203A70] text-white flex items-center justify-center font-bold text-base overflow-hidden flex-shrink-0 shadow-sm">
              {props.counterpartAvatar && (props.counterpartAvatar.startsWith("http") || props.counterpartAvatar.startsWith("data:")) ? (
                <img src={props.counterpartAvatar} alt={props.counterpartName} className="w-full h-full object-cover" />
              ) : (
                getInitials(props.counterpartName)
              )}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-base font-bold text-[#203A70] truncate">{props.counterpartName}</h4>
              <p className="text-xs text-[#00A69D] font-semibold truncate mt-0.5">
                {props.counterpartSpecialty || (props.role === "doctor" ? "Paciente Registrado" : "Médico Especialista")}
              </p>
              {props.appointmentReason && (
                <p className="text-xs text-gray-500 truncate mt-1">Motivo: {props.appointmentReason}</p>
              )}
            </div>
          </div>

          {/* Recomendaciones y Lista de Verificación Antes de Ingresar */}
          <div className="flex flex-col gap-2.5 bg-[#F0FFFE] p-4 rounded-2xl border border-[#CCFBF6]">
            <h4 className="text-xs font-bold text-[#00A69D] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-[#00A69D]" />
              Recomendaciones de Consulta
            </h4>
            <ul className="space-y-2 text-xs text-gray-600 font-medium">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00A69D] mt-1.5 flex-shrink-0" />
                <span>Usa buena iluminación de frente a tu rostro.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00A69D] mt-1.5 flex-shrink-0" />
                <span>Se recomiendan audífonos para mayor claridad de audio.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00A69D] mt-1.5 flex-shrink-0" />
                <span>Videollamada médica cifrada e integrada.</span>
              </li>
            </ul>
          </div>

          {/* Botones de Acción Estilo Estándar */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleJoinClick}
              className="w-full py-3.5 px-6 rounded-xl bg-[#00A69D] hover:bg-[#008f87] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Video size={18} />
              <span>Unirse a la Teleconsulta</span>
            </button>

            <button
              onClick={props.onEndCall}
              className="w-full py-3 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-all text-center cursor-pointer"
            >
              Cancelar y salir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelemedicinaRoomContent({
  role,
  userName,
  userAvatar,
  counterpartName,
  counterpartAvatar,
  counterpartSpecialty,
  patientId,
  appointmentId,
  appointmentReason,
  onEndCall,
  onEmitRxSuccess,
  isMinimized,
  onReturnToCall,
  startTime,
  initialVideoOff,
  initialAudioMuted,
  initialLsaOn
}: TelemedicinaRoomProps & { startTime: number; initialVideoOff: boolean; initialAudioMuted: boolean; initialLsaOn?: boolean }) {
  // Fuente única de verdad para estados mic/cámara — desde eventos RoomEvent
  const roomCode = appointmentId ? String(appointmentId) : "global";
  const { localParticipant } = useLocalParticipant();
  const [isMicOn, setIsMicOn] = useState(!initialAudioMuted);
  const [isVideoOn, setIsVideoOn] = useState(!initialVideoOff);
  const [hasCameraDevice, setHasCameraDevice] = useState(true); // optimista; se corrige tras enumerateDevices
  const [hasMicDevice, setHasMicDevice] = useState(true);

  // Detectar dispositivos disponibles al montar
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const hasVideo = devices.some(d => d.kind === "videoinput");
      const hasAudio = devices.some(d => d.kind === "audioinput");
      setHasCameraDevice(hasVideo);
      setHasMicDevice(hasAudio);
      // Si no hay cámara, forzar estado visual a apagado
      if (!hasVideo) setIsVideoOn(false);
      if (!hasAudio) setIsMicOn(false);
    }).catch(() => {
      // Sin permiso aún — no cambiar estado, lo maneja LiveKit
    });
  }, []);

  const muted = !isMicOn;
  const videoOff = !isVideoOn;

  const handleToggleMic = async () => {
    if (!localParticipant || !hasMicDevice) return;
    const nextMic = !isMicOn;
    setIsMicOn(nextMic); // Respuesta visual instantánea (0ms)
    try {
      await localParticipant.setMicrophoneEnabled(nextMic);
    } catch (err) {
      console.warn("Error en micrófono:", err);
      setIsMicOn(!nextMic); // Revertir si falla la adquisición del dispositivo
    }
  };

  const handleToggleCamera = async () => {
    if (!localParticipant) return;
    if (!hasCameraDevice) {
      setIsVideoOn(false);
      return;
    }
    const nextVideo = !isVideoOn;
    setIsVideoOn(nextVideo); // Respuesta visual instantánea (0ms)
    try {
      await localParticipant.setCameraEnabled(nextVideo);
    } catch (err) {
      console.warn("Error en cámara:", err);
      setIsVideoOn(!nextVideo); // Revertir si falla
    }
  };

  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [lseMode, setLseMode] = useState<boolean>(() => {
    if (typeof initialLsaOn === "boolean") return initialLsaOn;
    return localStorage.getItem("lsa_preference") !== "false";
  });
  const [isLsaEnabledInSettings, setIsLsaEnabledInSettings] = useState<boolean>(true);
  const [isVideoSubtitlesEnabled, setIsVideoSubtitlesEnabled] = useState<boolean>(true);
  const [subtitleSizeSetting, setSubtitleSizeSetting] = useState<string>("Mediano");
  const [showRxMedSuggestions, setShowRxMedSuggestions] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "subtitles" | "rx" | "notes">("subtitles");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEndedByDoctor, setIsEndedByDoctor] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

  // Sincronización dinámica de preferencias de Configuración (Accesibilidad / LSA / Subtítulos)
  useEffect(() => {
    const updateSettings = () => {
      const lsaPref = localStorage.getItem("lsa_preference") !== "false";
      setIsLsaEnabledInSettings(lsaPref);

      const subSize = localStorage.getItem("subtitle_size") || "Mediano";
      setSubtitleSizeSetting(subSize);

      const videoSubPref = localStorage.getItem("settings_video_subtitles_enabled") !== "false";
      setIsVideoSubtitlesEnabled(videoSubPref);
    };

    updateSettings();

    window.addEventListener("lsaPreferenceChanged", updateSettings);
    window.addEventListener("subtitleSizeChanged", updateSettings);
    window.addEventListener("videoSubtitlesPreferenceChanged", updateSettings);
    window.addEventListener("storage", updateSettings);
    return () => {
      window.removeEventListener("lsaPreferenceChanged", updateSettings);
      window.removeEventListener("subtitleSizeChanged", updateSettings);
      window.removeEventListener("videoSubtitlesPreferenceChanged", updateSettings);
      window.removeEventListener("storage", updateSettings);
    };
  }, []);

  // LiveKit Hooks para Tracks de Video y Audio con Sincronización Inmediata
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const audioTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  const localCameraTrack = cameraTracks.find(t => t.participant.isLocal);
  const remoteCameraTrack = cameraTracks.find(t => !t.participant.isLocal);
  const localAudioTrack = audioTracks.find(t => t.participant.isLocal);
  const remoteAudioTrack = audioTracks.find(t => !t.participant.isLocal);

  // Guardar preferencia local en LocalStorage
  useEffect(() => {
    localStorage.setItem("local_audio_muted", muted ? "true" : "false");
    localStorage.setItem("local_video_off", videoOff ? "true" : "false");
  }, [muted, videoOff]);

  // Arrastre interactivo y magnetismo a esquinas de ventana flotante (PIP)
  type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
  const [pipCorner, setPipCorner] = useState<CornerPosition>("bottom-right");
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const pipRef = useRef<HTMLDivElement | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);

  const cornerStyles: Record<CornerPosition, React.CSSProperties> = {
    "top-left": { top: "16px", left: "16px" },
    "top-right": { top: "16px", left: "calc(100% - 304px)" },
    "bottom-left": { top: "calc(100% - 178px)", left: "16px" },
    "bottom-right": { top: "calc(100% - 178px)", left: "calc(100% - 304px)" }
  };

  const minimizedCornerStyles: Record<CornerPosition, React.CSSProperties> = {
    "top-left": { top: "calc(var(--topbar-height, 66px) + 16px)", left: "calc(var(--sidebar-width, 240px) + 16px)" },
    "top-right": { top: "calc(var(--topbar-height, 66px) + 16px)", left: "calc(100vw - 304px)" },
    "bottom-left": { top: "calc(100vh - 178px)", left: "calc(var(--sidebar-width, 240px) + 16px)" },
    "bottom-right": { top: "calc(100vh - 178px)", left: "calc(100vw - 304px)" }
  };

  const handleMouseDownPip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
    setIsDraggingPip(true);
    setDragDelta({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isDraggingPip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }
      setDragDelta({ x: dx, y: dy });
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDraggingPip(false);

      if (pipRef.current) {
        let containerRect: DOMRect | { left: number; top: number; width: number; height: number };

        if (isMinimized) {
          // Para calcular en qué cuadrante soltó el usuario, usamos la pantalla completa
          containerRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        } else if (mainContainerRef.current) {
          containerRect = mainContainerRef.current.getBoundingClientRect();
        } else {
          containerRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        }

        const pipRect = pipRef.current.getBoundingClientRect();
        const pipCenterX = pipRect.left + pipRect.width / 2;
        const pipCenterY = pipRect.top + pipRect.height / 2;

        const relativeX = pipCenterX - containerRect.left;
        const relativeY = pipCenterY - containerRect.top;

        const isLeft = relativeX < containerRect.width / 2;
        const isTop = relativeY < containerRect.height / 2;

        let newCorner: CornerPosition = "bottom-right";
        if (isLeft && isTop) newCorner = "top-left";
        else if (!isLeft && isTop) newCorner = "top-right";
        else if (isLeft && !isTop) newCorner = "bottom-left";
        else if (!isLeft && !isTop) newCorner = "bottom-right";

        setPipCorner(newCorner);
        setSubtitleAnchor(prev => {
          if (prev === newCorner) {
            if (newCorner === "bottom-right" || newCorner === "bottom-left") return "bottom-center";
            if (newCorner === "top-right" || newCorner === "top-left") return "top-center";
          }
          return prev;
        });
      }
      setDragDelta({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPip]);

  const handlePipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasDraggedRef.current) {
      setIsSwapped(!isSwapped);
    }
  };

  // Arrastre interactivo y magnetismo multianclaje para la tarjeta de subtítulos en pantalla
  type SubtitleAnchor = "bottom-center" | "top-center" | "bottom-left" | "bottom-right" | "top-left" | "top-right";
  const [subtitleAnchor, setSubtitleAnchor] = useState<SubtitleAnchor>("bottom-center");
  const [isDraggingSub, setIsDraggingSub] = useState(false);
  const [subDragDelta, setSubDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const subCardRef = useRef<HTMLDivElement | null>(null);
  const subDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDownSub = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    subDragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDraggingSub(true);
    setSubDragDelta({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isDraggingSub) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - subDragStartRef.current.x;
      const dy = e.clientY - subDragStartRef.current.y;
      setSubDragDelta({ x: dx, y: dy });
    };

    const handleMouseUp = () => {
      setIsDraggingSub(false);

      if (subCardRef.current) {
        let containerRect: DOMRect | { left: number; top: number; width: number; height: number };

        if (mainContainerRef.current) {
          containerRect = mainContainerRef.current.getBoundingClientRect();
        } else {
          containerRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        }

        const subRect = subCardRef.current.getBoundingClientRect();
        const subCenterX = subRect.left + subRect.width / 2;
        const subCenterY = subRect.top + subRect.height / 2;

        const relativeX = subCenterX - containerRect.left;
        const relativeY = subCenterY - containerRect.top;

        const thirdWidth = containerRect.width / 3;
        const halfHeight = containerRect.height / 2;

        let newAnchor: SubtitleAnchor = "bottom-center";

        if (relativeY < halfHeight) {
          // Zona Superior
          if (relativeX < thirdWidth) newAnchor = "top-left";
          else if (relativeX > thirdWidth * 2) newAnchor = "top-right";
          else newAnchor = "top-center";
        } else {
          // Zona Inferior
          if (relativeX < thirdWidth) newAnchor = "bottom-left";
          else if (relativeX > thirdWidth * 2) newAnchor = "bottom-right";
          else newAnchor = "bottom-center";
        }

        // Prevención de colisión: Si coincide con el anclaje del PIP, esquiva a centro o zona contraria
        if (newAnchor === pipCorner) {
          if (newAnchor === "bottom-right" || newAnchor === "bottom-left") newAnchor = "bottom-center";
          else if (newAnchor === "top-right" || newAnchor === "top-left") newAnchor = "top-center";
        }

        setSubtitleAnchor(newAnchor);
      }
      setSubDragDelta({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSub]);

  const getSubtitleAnchorStyle = (): React.CSSProperties => {
    const baseTransition = isDraggingSub
      ? "none"
      : "top 350ms cubic-bezier(0.16, 1, 0.3, 1), bottom 350ms cubic-bezier(0.16, 1, 0.3, 1), left 350ms cubic-bezier(0.16, 1, 0.3, 1), right 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)";

    switch (subtitleAnchor) {
      case "top-center":
        return {
          top: "24px",
          left: "50%",
          transform: isDraggingSub
            ? `translate3d(calc(-50% + ${subDragDelta.x}px), ${subDragDelta.y}px, 0px)`
            : "translate3d(-50%, 0px, 0px)",
          transition: baseTransition
        };
      case "top-left":
        return {
          top: "24px",
          left: "24px",
          transform: isDraggingSub
            ? `translate3d(${subDragDelta.x}px, ${subDragDelta.y}px, 0px)`
            : "translate3d(0px, 0px, 0px)",
          transition: baseTransition
        };
      case "top-right":
        return {
          top: "24px",
          right: "24px",
          transform: isDraggingSub
            ? `translate3d(${subDragDelta.x}px, ${subDragDelta.y}px, 0px)`
            : "translate3d(0px, 0px, 0px)",
          transition: baseTransition
        };
      case "bottom-left":
        return {
          bottom: "75px",
          left: "24px",
          transform: isDraggingSub
            ? `translate3d(${subDragDelta.x}px, ${subDragDelta.y}px, 0px)`
            : "translate3d(0px, 0px, 0px)",
          transition: baseTransition
        };
      case "bottom-right":
        return {
          bottom: "75px",
          right: "24px",
          transform: isDraggingSub
            ? `translate3d(${subDragDelta.x}px, ${subDragDelta.y}px, 0px)`
            : "translate3d(0px, 0px, 0px)",
          transition: baseTransition
        };
      case "bottom-center":
      default:
        return {
          bottom: "75px",
          left: "50%",
          transform: isDraggingSub
            ? `translate3d(calc(-50% + ${subDragDelta.x}px), ${subDragDelta.y}px, 0px)`
            : "translate3d(-50%, 0px, 0px)",
          transition: baseTransition
        };
    }
  };

  // Subtítulos y Transcripciones en tiempo real desde FastAPI
  const [subtitlesList, setSubtitlesList] = useState<{
    id: number;
    speaker_name: string;
    speaker_role: string;
    speaker_avatar?: string;
    text: string;
    timestamp: string;
    is_draft?: boolean;
  }[]>([]);
  const subtitlesEndRef = useRef<HTMLDivElement | null>(null);
  const subtitlesContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll smooth inteligente para los subtítulos
  useEffect(() => {
    if (subtitlesContainerRef.current) {
      const container = subtitlesContainerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;

      // Aumentamos el umbral a 400px porque las burbujas de chat son altas con los márgenes
      if (scrollHeight - scrollTop - clientHeight < 400) {
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [subtitlesList]);

  // Setup DataChannel para Sincronización Inmediata de Subtítulos y Eventos RTC
  const { send } = useDataChannel("subtitles", (msg) => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(msg.payload));
      if (parsed.type === "END_CALL") {
        setIsEndedByDoctor(true);
      } else if (parsed.type === "SUBTITLE") {
        setSubtitlesList(prev => {
          const newList = [...prev];
          const lastSub = newList[newList.length - 1];
          const isSameSpeakerAndDraft = lastSub && lastSub.is_draft && lastSub.speaker_role === parsed.speaker_role;

          if (parsed.is_draft) {
            if (isSameSpeakerAndDraft) {
              lastSub.text = lastSub.text.replace("...", "") + ` ${parsed.text}...`;
              lastSub.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              newList.push({
                id: Date.now(),
                speaker_name: parsed.speaker_name,
                speaker_role: parsed.speaker_role,
                text: `${parsed.text}...`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_draft: true
              });
            }
          } else {
            // Final sentence
            if (isSameSpeakerAndDraft) {
              lastSub.text = parsed.text;
              lastSub.is_draft = false;
              lastSub.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              newList.push({
                id: Date.now(),
                speaker_name: parsed.speaker_name,
                speaker_role: parsed.speaker_role,
                text: parsed.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_draft: false
              });
            }
          }
          localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(newList));
          return newList;
        });
      }
    } catch (e) { }
  });

  // Cargar historial de subtítulos (Híbrido)
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await api.getRoomSubtitles(roomCode);
        if (history && history.length > 0) {
          setSubtitlesList(history);
          localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(history));
        } else {
          const saved = localStorage.getItem(`teleconsult_subtitles_${roomCode}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) setSubtitlesList(parsed);
            } catch (e) { }
          }
        }
      } catch (e) {
        const saved = localStorage.getItem(`teleconsult_subtitles_${roomCode}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setSubtitlesList(parsed);
          } catch (err) { }
        }
      }
    };
    loadHistory();
  }, [roomCode]);

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Motor de Transcripción STT Exclusivo con Modelo Deepgram Nova-3 (Servidor)
  useEffect(() => {
    if (muted) return;

    let mediaRecorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval>;
    let silenceTimer: ReturnType<typeof setTimeout>;

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let dataArray: Uint8Array;
    let isSpeaking = false;
    let recordStartTime = 0;

    const mediaTrack = localAudioTrack?.publication?.track?.mediaStreamTrack;
    if (!mediaTrack || mediaTrack.readyState !== "live") return;

    const handleDeepgramTranscription = (text: string) => {
      const cleanText = text ? text.trim() : "";
      if (!cleanText || cleanText.length < 2) return;
      if (["Audio.", "Audio", "Gracias."].includes(cleanText)) return;

      const nowTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setSubtitlesList(prev => {
        const lastSub = prev.length > 0 ? prev[prev.length - 1] : null;

        // Concatenar frase al último subtítulo si pertenece al MISMO hablante
        if (lastSub && lastSub.speaker_role === role && lastSub.speaker_name === userName) {
          const lowerLast = lastSub.text.toLowerCase();
          const lowerNew = cleanText.toLowerCase();

          // Evitar añadir duplicados idénticos
          if (lowerLast.endsWith(lowerNew) || lowerLast === lowerNew) {
            return prev;
          }

          const updatedText = `${lastSub.text} ${cleanText}`.trim();
          const updatedList = [...prev.slice(0, prev.length - 1), { ...lastSub, text: updatedText, timestamp: nowTimestamp }];
          localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(updatedList));
          return updatedList;
        } else {
          // Nueva tarjeta para un nuevo hablante o intervención
          const newSub = {
            id: Date.now(),
            speaker_name: userName,
            speaker_role: role,
            text: cleanText,
            timestamp: nowTimestamp
          };
          const newList = [...prev, newSub];
          localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(newList));
          return newList;
        }
      });

      // Transmitir al interlocutor por el DataChannel de LiveKit
      if (sendRef.current) {
        sendRef.current(new TextEncoder().encode(JSON.stringify({
          type: "SUBTITLE",
          speaker_name: userName,
          speaker_role: role,
          text: cleanText
        })), { reliable: true });
      }

      // Persistir en servidor
      api.postRoomSubtitle(roomCode, {
        speaker_name: userName,
        speaker_role: role,
        text: cleanText,
        timestamp: nowTimestamp
      }).catch(err => console.error("Error guardando subtítulo en backend:", err));
    };

    try {
      stream = new MediaStream([mediaTrack.clone()]);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      let chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          chunks = [];
          if (blob.size > 2500) {
            try {
              const res = await api.transcribeTelemedicineAudio(blob);
              if (res.text) {
                handleDeepgramTranscription(res.text);
              }
            } catch (e) {
              console.error("Error en STT Deepgram Nova-3:", e);
            }
          }
        }
      };

      interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);

        // Analizar energía vocal en la banda de frecuencia de la voz humana (80Hz a 3.5kHz)
        let sum = 0;
        const speechBins = Math.min(40, dataArray.length);
        for (let i = 2; i < speechBins; i++) sum += dataArray[i];
        const speechAvg = sum / (speechBins - 2);
        const now = Date.now();

        if (speechAvg > 7) {
          if (!isSpeaking) {
            isSpeaking = true;
            recordStartTime = now;
            if (mediaRecorder?.state === "inactive") mediaRecorder.start();
          }
          clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => {
            isSpeaking = false;
            if (mediaRecorder?.state === "recording") mediaRecorder.stop();
          }, 2200);
        }

        // Si la persona habla de forma continua durante más de 12 segundos, enviar el fragmento a Deepgram
        if (isSpeaking && mediaRecorder?.state === "recording" && (now - recordStartTime > 12000)) {
          clearTimeout(silenceTimer);
          isSpeaking = false;
          mediaRecorder.stop();
        }
      }, 100);
    } catch (e) {
      console.error("Error configurando VAD de Deepgram:", e);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (audioContext) audioContext.close();
    };
  }, [muted, role, userName, roomCode, localAudioTrack]);



  // Auto-exit timer for patient when doctor finishes call
  useEffect(() => {
    if (isEndedByDoctor) {
      const timer = setTimeout(() => {
        onEndCall();
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [isEndedByDoctor, onEndCall]);

  // In-Call Live Chat / Comments
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string; role: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Doctor Rx State
  const [rxForm, setRxForm] = useState({ medicine: "", dose: "", frequency: "", expires_at_date: "" });
  const [rxSubmitted, setRxSubmitted] = useState(false);
  const [isEmittingRx, setIsEmittingRx] = useState(false);

  // Doctor Clinical Summary
  const [clinicalNotes, setClinicalNotes] = useState("");

  // 1. Single Source of Truth Live Call Timer (Basado en el Servidor)
  useEffect(() => {
    if (!startTime) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor(Date.now() / 1000) - startTime;
      setElapsedSecs(Math.max(0, elapsed));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // 3. Real-Time Room Presence & Media State Tracking (Nativo LiveKit)
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  const [isPipSpeaking, setIsPipSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [, setRtcUpdateCounter] = useState(0);

  // FIX #1: Refs estables para isSwapped y localParticipant para evitar el re-registro
  // infinito de listeners que destruía la conexión WebRTC en cada re-render.
  const isSwappedRef = useRef(isSwapped);
  const localParticipantRef = useRef(localParticipant);
  useEffect(() => { isSwappedRef.current = isSwapped; }, [isSwapped]);
  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);

  useEffect(() => {
    if (!room) return;

    const triggerUpdate = () => setRtcUpdateCounter(c => c + 1);

    const handleActiveSpeakers = (speakers: Participant[]) => {
      const currentRemotes = Array.from(room.remoteParticipants.values());
      const pipParticipant = isSwappedRef.current ? currentRemotes[0] : localParticipantRef.current;
      setIsPipSpeaking(pipParticipant ? speakers.some(p => p.sid === pipParticipant.sid) : false);
      const remote = currentRemotes[0];
      setIsRemoteSpeaking(remote ? speakers.some(p => p.sid === remote.sid) : false);
      triggerUpdate();
    };

    const handleTrackMuted = () => {
      triggerUpdate();
    };

    const handleTrackUnmuted = () => {
      triggerUpdate();
    };

    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    room.on(RoomEvent.TrackPublished, triggerUpdate);
    room.on(RoomEvent.TrackUnpublished, triggerUpdate);
    room.on(RoomEvent.TrackSubscribed, triggerUpdate);
    room.on(RoomEvent.TrackUnsubscribed, triggerUpdate);
    room.on(RoomEvent.ParticipantConnected, triggerUpdate);
    room.on(RoomEvent.ParticipantDisconnected, triggerUpdate);

    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.off(RoomEvent.TrackPublished, triggerUpdate);
      room.off(RoomEvent.TrackUnpublished, triggerUpdate);
      room.off(RoomEvent.TrackSubscribed, triggerUpdate);
      room.off(RoomEvent.TrackUnsubscribed, triggerUpdate);
      room.off(RoomEvent.ParticipantConnected, triggerUpdate);
      room.off(RoomEvent.ParticipantDisconnected, triggerUpdate);
    };
  // FIX #1: Solo `room` como dependencia — los demás son accedidos via refs estables
  }, [room]);

  const isCounterpartConnected = remoteParticipants.length > 0;
  const isCounterpartVideoOff = !remoteCameraTrack || !remoteCameraTrack.publication || remoteCameraTrack.publication.isMuted || remoteCameraTrack.publication.isSubscribed === false || remoteCameraTrack.participant?.isCameraEnabled === false;
  const isCounterpartMuted = !remoteAudioTrack || !remoteAudioTrack.publication || remoteAudioTrack.publication.isMuted || remoteAudioTrack.participant?.isMicrophoneEnabled === false;
  const [presenceToast, setPresenceToast] = useState<string | null>(null);
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    if (isCounterpartConnected && !prevConnectedRef.current) {
      const msg = role === "doctor"
        ? `¡${counterpartName} se ha unido a la teleconsulta!`
        : `¡El ${counterpartName} se ha conectado a la sala!`;
      setPresenceToast(msg);
      setTimeout(() => setPresenceToast(null), 4500);
    } else if (!isCounterpartConnected && prevConnectedRef.current) {
      const msg = role === "doctor"
        ? `${counterpartName} ha salido de la sala.`
        : `El ${counterpartName} se ha desconectado.`;
      setPresenceToast(msg);
      setTimeout(() => setPresenceToast(null), 4500);
    }
    prevConnectedRef.current = isCounterpartConnected;

    // Verificación de finalización de cita para el paciente
    if (role === "patient" && appointmentId) {
      const checkAppointment = async () => {
        try {
          const token = getToken();
          const res = await fetch(`${API_BASE_URL}/api/appointments`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const apts = await res.json();
            const myApt = apts.find((a: any) => a.id === appointmentId);
            if (myApt && myApt.status === "completada") {
              setIsEndedByDoctor(true);
            }
          }
        } catch (e) { }
      };

      const statusKey = `room_status_${roomCode}`;
      const rawStatus = localStorage.getItem(statusKey);
      if (rawStatus) {
        try {
          const parsedStatus = JSON.parse(rawStatus);
          if (parsedStatus.status === "completada" || parsedStatus.status === "ended") {
            setIsEndedByDoctor(true);
          }
        } catch (e) { }
      }

      // Chequeo periódico suave (cada 15s) solo para fallback de estado de cita en BD
      const interval = setInterval(checkAppointment, 15000);
      return () => clearInterval(interval);
    }
  }, [isCounterpartConnected, role, counterpartName, appointmentId, roomCode]);

  // Limpieza de preferencias de hardware al terminar la llamada
  useEffect(() => {
    return () => {
      // Optional cleanup on component unmount
    };
  }, []);

  // ──────────────────────────────────────────────
  // Lógica ISLR (Reconocimiento de Lenguaje de Señas)
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!lseMode || role !== "patient") return;

    // Obtener la pista de video local del paciente
    const trackPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const mediaStreamTrack = trackPub?.videoTrack?.mediaStreamTrack;
    if (!mediaStreamTrack) {
      console.warn("[ISLR] No se encontró cámara local para el paciente.");
      return;
    }

    // Crear elementos ocultos para capturar frames
    const stream = new MediaStream([mediaStreamTrack]);
    const video = document.createElement("video");
    video.style.display = "none";
    document.body.appendChild(video);
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let interval: NodeJS.Timeout;

    // FIX #3: Usar URL de backend correcta desde variables de entorno (no localhost hardcodeado)
    const wsBaseUrl = ((import.meta as any).env?.VITE_API_BASE_URL || "https://superucedoc-api.duckdns.org")
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const ws = new WebSocket(`${wsBaseUrl}/api/sign-language/stream/${roomCode}`);

    ws.onopen = () => {
      console.log("[ISLR] Conectado al traductor de señas.");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const speakerName = userName; // Usar el nombre real del paciente

        if (data.type === "SIGN_PREDICTED" && data.sign) {
          const signText = data.sign;

          setSubtitlesList(prev => {
            const newList = [...prev];
            const lastSub = newList[newList.length - 1];
            const isSameSpeakerAndDraft = lastSub && lastSub.is_draft && lastSub.speaker_role === "patient";

            if (isSameSpeakerAndDraft) {
              lastSub.text = lastSub.text.replace("...", "") + ` ${signText}...`;
              lastSub.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              newList.push({
                id: Date.now(),
                speaker_name: speakerName,
                speaker_role: "patient",
                text: `${signText}...`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_draft: true
              });
            }
            localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(newList));
            return newList;
          });

          // Enviar subtítulo parcial al Doctor usando DataChannel
          if (sendRef.current) {
            sendRef.current(new TextEncoder().encode(JSON.stringify({
              type: "SUBTITLE",
              text: signText,
              speaker_name: speakerName,
              speaker_role: "patient",
              is_draft: true
            })), { reliable: true });
          }
        } else if (data.type === "SENTENCE_PREDICTED" && data.sentence) {
          const sentence = data.sentence;

          setSubtitlesList(prev => {
            const newList = [...prev];
            const lastSub = newList[newList.length - 1];
            const isSameSpeakerAndDraft = lastSub && lastSub.is_draft && lastSub.speaker_role === "patient";

            if (isSameSpeakerAndDraft) {
              lastSub.text = sentence;
              lastSub.is_draft = false;
              lastSub.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              newList.push({
                id: Date.now(),
                speaker_name: speakerName,
                speaker_role: "patient",
                text: sentence,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_draft: false
              });
            }
            localStorage.setItem(`teleconsult_subtitles_${roomCode}`, JSON.stringify(newList));
            return newList;
          });

          // Enviar subtítulo final al Doctor usando DataChannel
          if (sendRef.current) {
            sendRef.current(new TextEncoder().encode(JSON.stringify({
              type: "SUBTITLE",
              text: sentence,
              speaker_name: speakerName,
              speaker_role: "patient",
              is_draft: false
            })), { reliable: true });
          }
        }
      } catch (e) { }
    };

    video.onloadedmetadata = () => {
      video.play().catch(e => console.error("[ISLR] Error playing video:", e));
      console.log("[ISLR] Comenzando a capturar frames...");

      // Reducir resolución para no saturar al backend con imágenes gigantes
      canvas.width = 480;
      canvas.height = (video.videoHeight / video.videoWidth) * 480 || 360;

      let sentFrames = 0;
      // Capturar a ~15 FPS (66ms) para mantener tiempo real estricto pero reducir lag en el backend
      interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && ctx) {
          // Si el servidor o la red están saturados (más de 50KB en cola), saltar el frame actual
          if (ws.bufferedAmount > 50000) {
            return;
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Bajar calidad JPEG a 0.5 para hacer el payload en base64 súper ligero
          const base64 = canvas.toDataURL("image/jpeg", 0.5);
          ws.send(JSON.stringify({ type: "FRAME", frame: base64 }));

          sentFrames++;
          if (sentFrames % 15 === 0) {
            console.log(`[ISLR] ${sentFrames} frames enviados al backend (Optimizado a 15 FPS).`);
          }
        }
      }, 66);
    };

    return () => {
      clearInterval(interval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      video.srcObject = null;
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
    };
  }, [lseMode, role, localParticipant, roomCode, localCameraTrack?.publication?.track]);

  // Poll & Load Live Comments from Backend REST API + LocalStorage fallback
  const storageKey = appointmentId ? `teleconsult_comments_${appointmentId}` : `teleconsult_comments_demo`;

  useEffect(() => {
    // Reset chat messages when entering a room to avoid showing previous session chats
    setChatMessages([]);

    const loadComments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/realtime/comments/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setChatMessages(data);
            if (role === "patient") {
              const finishedSignal = data.some((m: any) => m.text === "__ROOM_FINISHED_BY_DOCTOR__");
              if (finishedSignal) {
                setIsEndedByDoctor(true);
              }
            }
            return;
          }
        }
      } catch (e) { }

      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setChatMessages(parsed);
          if (role === "patient" && Array.isArray(parsed)) {
            const finishedSignal = parsed.some((m: any) => m.text === "__ROOM_FINISHED_BY_DOCTOR__");
            if (finishedSignal) {
              setIsEndedByDoctor(true);
            }
          }
        } else {
          setChatMessages([]);
        }
      } catch (e) { }
    };

    loadComments();
    // FIX #4: Reducir polling de 1500ms a 5000ms para liberar el event loop del browser
    // durante la carga de CPU del WebRTC + AudioContext + H.264 encode concurrentes.
    const interval = setInterval(loadComments, 5000);
    return () => clearInterval(interval);
  }, [roomCode, storageKey, role]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
    const newMsg = {
      sender: userName,
      text: chatInput.trim(),
      time: timeStr,
      role: role
    };

    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    setChatInput("");

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) { }

    try {
      await fetch(`${API_BASE_URL}/api/realtime/comments/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg)
      });
    } catch (e) {
      console.error("Error enviando comentario al backend", e);
    }
  };

  const handleEmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxForm.medicine.trim()) return;
    try {
      setIsEmittingRx(true);
      await api.createPrescription({
        patient_id: patientId || 0,
        appointment_id: appointmentId,
        medicine: rxForm.medicine.trim(),
        dose: rxForm.dose.trim() || "1 comprimido",
        frequency: rxForm.frequency.trim() || "Cada 24 horas",
        expires_in_days: 30,
        expires_at_date: rxForm.expires_at_date || undefined
      });
      setRxSubmitted(true);
      setRxForm({ medicine: "", dose: "", frequency: "", expires_at_date: "" });
      onEmitRxSuccess?.();
    } catch (err: any) {
      alert("Error al emitir receta: " + (err.message || "Error de servidor"));
    } finally {
      setIsEmittingRx(false);
    }
  };

  const handleFinishCall = async () => {
    try {
      if (appointmentId && role === "doctor") {
        setIsEndingCall(true);
        if (sendRef.current) {
          sendRef.current(new TextEncoder().encode(JSON.stringify({ type: "END_CALL" })), { reliable: true });
        }

        let transcript = "";
        if (subtitlesList.length > 0) {
          transcript = subtitlesList.map(s => `${s.speaker_role === 'doctor' ? 'DOCTOR' : 'PACIENTE'}: ${s.text}`).join("\n");
        }
        if (!transcript) {
          transcript = "Sin conversación registrada.";
        }

        await api.summarizeConsultation(appointmentId, transcript, clinicalNotes.trim());
        await api.updateAppointmentStatus(appointmentId, "completada");

        // Broadcast room completion locally & via realtime channel
        const statusKey = `room_status_${roomCode}`;
        localStorage.setItem(statusKey, JSON.stringify({ status: "completada", endedBy: "doctor", endedAt: new Date().toISOString() }));

        try {
          await fetch(`${API_BASE_URL}/api/realtime/end/${roomCode}`, { method: "POST" });
          await fetch(`${API_BASE_URL}/api/realtime/comments/${roomCode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: "SISTEMA",
              text: "__ROOM_FINISHED_BY_DOCTOR__",
              time: new Date().toLocaleTimeString("es-DO"),
              role: "system"
            })
          });
        } catch (e) { }
      } else if (role === "patient") {
        // El paciente abandona explícitamente la teleconsulta
        try {
          await fetch(`${API_BASE_URL}/api/realtime/leave/${roomCode}/patient`, { method: "POST" });
        } catch (e) { }
      }
    } catch (err) {
      console.error("Error al salir de consulta", err);
    } finally {
      // Limpiar preferencias locales para próxima consulta
      localStorage.removeItem("local_video_off");
      localStorage.removeItem("local_audio_muted");
      localStorage.removeItem(`teleconsult_subtitles_${roomCode}`);
      localStorage.removeItem(`teleconsult_chat_${roomCode}`);
      localStorage.removeItem(`teleconsult_comments_${roomCode}`);
      localStorage.removeItem(`doctor_in_active_call_${roomCode}`);
      sessionStorage.removeItem(`has_joined_teleconsult_${roomCode}`);
      onEndCall();
    }
  };


  if (isMinimized) {
    const handleMinimizedClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasDraggedRef.current && onReturnToCall) {
        onReturnToCall();
      }
    };

    return (
      <>
        <div
          ref={pipRef}
          onMouseDown={handleMouseDownPip}
          onClick={handleMinimizedClick}
          style={{
            ...minimizedCornerStyles[pipCorner],
            transform: isDraggingPip
              ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0px)`
              : "translate3d(0px, 0px, 0px)",
            transition: isDraggingPip
              ? "none"
              : "top 350ms cubic-bezier(0.16, 1, 0.3, 1), left 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: 9999
          }}
          className={`fixed w-[288px] h-[162px] rounded-xl overflow-hidden bg-slate-800 border-2 shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-all duration-300 pointer-events-auto ${isDraggingPip ? "scale-105 border-[#00C7C0]" : ""} ${(!isDraggingPip && isRemoteSpeaking) ? "ring-2 ring-[#00C7C0] border-[#00C7C0]" : "border-[#00A69D]"}`}
          title="Haz clic para volver a la videollamada o arrastra a cualquier esquina"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-black/70 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center shadow-md">
            <Maximize2 size={13} className="text-[#00C7C0]" />
          </div>
          <FloatingRoomContent
            counterpartAvatar={counterpartAvatar}
            counterpartName={counterpartName}
            getInitials={(name: string) => {
              if (!name) return "US";
              const parts = name.trim().split(/\s+/);
              if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
              return name.substring(0, 2).toUpperCase();
            }}
          />
        </div>

        {isEndedByDoctor && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-md w-full shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-extrabold text-[#203A70] mb-1.5">Teleconsulta Finalizada</h3>
              <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                El médico ha concluido la cita. Redirigiendo a tu historial de citas...
              </p>
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB] text-gray-800 overflow-hidden relative font-sans">

      {/* ─── BARRA SUPERIOR (ESTILO MÉDICO ESTÁNDAR) ─── */}
      <div className="flex items-center justify-between px-6 bg-white border-b border-gray-200 gap-3 z-20 shadow-xs flex-shrink-0" style={{ height: "66px" }}>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#203A70]">
              <h2 className="text-lg font-extrabold tracking-tight">Teleconsulta Médica en Vivo</h2>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 flex-wrap mt-0.5 font-medium">
              <span>{role === "doctor" ? "Paciente:" : "Médico:"} <strong className="text-[#203A70] font-bold">{counterpartName}</strong></span>
              {role === "patient" && counterpartSpecialty && (
                <>
                  <span className="opacity-40">•</span>
                  <span>{counterpartSpecialty}</span>
                </>
              )}
              {appointmentReason && (
                <>
                  <span className="opacity-40">•</span>
                  <span>Motivo: <span className="text-gray-700">{appointmentReason}</span></span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[#00A69D] text-sm font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A69D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00A69D]"></span>
            </span>
            <span>{formatTime(elapsedSecs)}</span>
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="px-4 py-1.5 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-700 shadow-sm transition-colors text-sm font-semibold flex items-center gap-2 cursor-pointer bg-white"
          >
            <MessageSquare size={15} className="text-[#00A69D]" />
            <span>{isSidebarOpen ? "Ocultar Panel" : "Ver Chat / Notas"}</span>
          </button>
        </div>
      </div>

      {/* ─── CUERPO PRINCIPAL (VIDEO + SIDEBAR CON ESTILO MÉDICO UNIFICADO) ─── */}
      <div className="flex-1 flex overflow-hidden relative p-4 gap-4 bg-[#F9FAFB]">

        {/* AREA DE VIDEO Y CONTROLES (IZQUIERDA) */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden relative">

          {/* VISOR DE VIDEO */}
          <div ref={mainContainerRef} className="flex-1 relative rounded-2xl overflow-hidden bg-[#111827] border border-gray-200 shadow-md flex items-center justify-center min-h-[380px]">

            {/* TOAST NOTIFICACIÓN EN SALA */}
            {presenceToast && (
              <div className="absolute top-4 z-30 px-4 py-2 rounded-xl bg-white text-[#203A70] text-xs font-bold shadow-xl border border-gray-200 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#00A69D]" />
                <span>{presenceToast}</span>
              </div>
            )}

            {/* VIDEO PANTALLA PRINCIPAL (VISTA CENTRAL LIMPIA CON SINCRONIZACIÓN MEDIA EN TIEMPO REAL) */}
            <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#111827] transition-all duration-300 ease-in-out select-none">
              {!isSwapped ? (
                /* MOSTRAR PARTICIPANTE REMOTO EN PANTALLA PRINCIPAL */
                !isCounterpartConnected ? (
                  <>
                    <div className="relative mb-3">
                      <div className="w-28 h-28 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center font-bold text-3xl overflow-hidden opacity-60">
                        {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                          <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(counterpartName)
                        )}
                      </div>
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-[#111827]" title="Desconectado" />
                    </div>

                    <h3 className="text-base font-bold text-white">{counterpartName}</h3>
                    <span className="text-xs text-amber-400 font-semibold mt-1">Desconectado · En espera</span>
                  </>
                ) : isCounterpartVideoOff ? (
                  /* CÁMARA REMOTA APAGADA: MOSTRAR INTERFAZ CON FOTO DE PERFIL CENTRADA */
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-3">
                      <div className="w-28 h-28 rounded-full bg-slate-800 border border-slate-700/80 text-white flex items-center justify-center font-bold text-3xl overflow-hidden shadow-md">
                        {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                          <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(counterpartName)
                        )}
                      </div>
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#00A69D] border-2 border-[#111827]" title="Conectado" />
                    </div>

                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{counterpartName}</span>
                    </h3>
                    {isCounterpartMuted && (
                      <span className="text-xs text-red-400 font-bold mt-1">Micrófono Desactivado</span>
                    )}
                  </div>
                ) : (
                  /* CÁMARA REMOTA PRENDIDA: CONTENEDOR LIMPIO CON NOMBRE E ÍCONO DE MICRÓFONO ABAJO A LA IZQUIERDA O DERECHA SEGÚN CORRESPONDA */
                  <div className="w-full h-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
                    {remoteCameraTrack && remoteCameraTrack.publication?.track ? (
                      <VideoTrack trackRef={remoteCameraTrack} className="w-full h-full object-cover" disablePictureInPicture={true} translate="no" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700/80 text-white flex items-center justify-center font-bold text-2xl mb-2 overflow-hidden shadow-md animate-pulse">
                          {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                            <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(counterpartName)
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white">{counterpartName}</h3>
                        <span className="text-xs text-[#00C7C0] font-semibold mt-1">Conectando Cámara...</span>
                      </div>
                    )}
                    <div className={`absolute z-10 font-bold text-xs text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 transition-all duration-300 ease-out ${pipCorner === "bottom-left" ? "bottom-4 right-4" : "bottom-4 left-4"
                      }`}>
                      <span>{counterpartName}</span>
                      {isCounterpartMuted ? (
                        <MicOff size={13} className="text-red-400" title="Micrófono Desactivado" />
                      ) : (
                        <Mic size={13} className="text-white/80" title="Micrófono Activo" />
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* MOSTRAR TU PROPIA CÁMARA EN PANTALLA PRINCIPAL CUANDO SE INTERCAMBIA DESDE EL DIV PIP */
                videoOff ? (
                  /* CÁMARA APAGADA: MOSTRAR INTERFAZ CON FOTO DE PERFIL CENTRADA */
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-3">
                      <div className="w-28 h-28 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-3xl overflow-hidden shadow-lg border border-white/20">
                        {userAvatar && (userAvatar.startsWith("http") || userAvatar.startsWith("data:")) ? (
                          <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(userName)
                        )}
                      </div>
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-slate-500 border-2 border-[#111827]" title="Cámara Desactivada" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{userName} (Tú)</h3>
                    {muted && <span className="text-xs text-red-400 font-bold mt-1">Micrófono Desactivado</span>}
                  </div>
                ) : (
                  /* CÁMARA PRENDIDA: CONTENEDOR LIMPIO CON NOMBRE E ÍCONO DE MICRÓFONO ABAJO A LA IZQUIERDA O DERECHA SEGÚN CORRESPONDA */
                  <div className="w-full h-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
                    {localCameraTrack && localCameraTrack.publication?.track ? (
                      <VideoTrack trackRef={localCameraTrack} className="w-full h-full object-cover -scale-x-100" disablePictureInPicture={true} translate="no" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-2xl mb-2 overflow-hidden shadow-md animate-pulse">
                          {userAvatar && (userAvatar.startsWith("http") || userAvatar.startsWith("data:")) ? (
                            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(userName)
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white">{userName} (Tú)</h3>
                        <span className="text-xs text-[#00C7C0] font-semibold mt-1">Conectando Cámara...</span>
                      </div>
                    )}
                    <div className={`absolute z-10 font-bold text-xs text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 transition-all duration-300 ease-out ${pipCorner === "bottom-left" ? "bottom-4 right-4" : "bottom-4 left-4"
                      }`}>
                      <span>{userName} (Tú)</span>
                      {muted ? (
                        <MicOff size={13} className="text-red-400" title="Micrófono Desactivado" />
                      ) : (
                        <Mic size={13} className="text-white/80" title="Micrófono Activo" />
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* RECUADRO PIP PEQUEÑO CON ARRASTRE FLUIDO Y MAGNETISMO A ESQUINAS */}
            <div
              ref={pipRef}
              onMouseDown={handleMouseDownPip}
              onClick={handlePipClick}
              style={{
                ...cornerStyles[pipCorner],
                transform: isDraggingPip
                  ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0px)`
                  : "translate3d(0px, 0px, 0px)",
                transition: isDraggingPip
                  ? "none"
                  : "top 350ms cubic-bezier(0.16, 1, 0.3, 1), left 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
                zIndex: isDraggingPip ? 50 : 20
              }}
              className={`absolute w-[288px] h-[162px] rounded-xl overflow-hidden bg-slate-800 border-2 shadow-2xl flex flex-col items-center justify-center select-none cursor-grab active:cursor-grabbing transition-all duration-300 ${isDraggingPip ? "scale-105 border-[#00C7C0]" : ""} ${(isSwapped && !isCounterpartConnected)
                ? "border-amber-500"
                : (!isDraggingPip && isPipSpeaking) ? "ring-2 ring-[#00C7C0] border-[#00C7C0]" : "border-[#00A69D]"
                }`}
              title="Arrastra a cualquier esquina o haz clic para intercambiar pantalla"
            >
              {/* ÍCONO DE INTERCAMBIAR FLOTANTE (SOLO VISIBLE EN HOVER / CLICK) */}
              <div className="absolute top-2 right-2 p-1.5 bg-black/70 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center shadow-md">
                <RefreshCw size={13} className={isSwapped && !isCounterpartConnected ? "text-amber-400" : "text-[#00C7C0]"} />
              </div>

              {!isSwapped ? (
                /* PIP MUESTRA CÁMARA PROPIA */
                videoOff ? (
                  /* CÁMARA APAGADA: MOSTRAR FOTO DE PERFIL EN PIP */
                  <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
                    <div className="w-10 h-10 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs mb-1 overflow-hidden shadow-md border border-slate-700/60">
                      {userAvatar && (userAvatar.startsWith("http") || userAvatar.startsWith("data:")) ? (
                        <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(userName)
                      )}
                    </div>
                    <span className="text-xs text-white font-bold truncate max-w-[130px]">{userName} (Tú)</span>
                    {muted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
                  </div>
                ) : (
                  /* CÁMARA PRENDIDA EN PIP: CONTENEDOR LIMPIO CON NOMBRE E ÍCONO DE MICRÓFONO ABAJO EN PEQUEÑO */
                  <div className="w-full h-full relative bg-slate-900 flex items-center justify-center p-2 overflow-hidden rounded-xl">
                    {localCameraTrack && localCameraTrack.publication?.track ? (
                      <VideoTrack trackRef={localCameraTrack} className="absolute inset-0 w-full h-full object-cover -scale-x-100" disablePictureInPicture={true} translate="no" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
                        <div className="w-10 h-10 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs mb-1 overflow-hidden shadow-md border border-slate-700/60 animate-pulse">
                          {userAvatar && (userAvatar.startsWith("http") || userAvatar.startsWith("data:")) ? (
                            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(userName)
                          )}
                        </div>
                        <span className="text-xs text-white font-bold truncate max-w-[130px]">{userName} (Tú)</span>
                        {muted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 z-10 font-bold text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 max-w-[150px]">
                      <span className="truncate">{userName} (Tú)</span>
                      {muted ? (
                        <MicOff size={11} className="text-red-400 flex-shrink-0" title="Micrófono Desactivado" />
                      ) : (
                        <Mic size={11} className="text-white/80 flex-shrink-0" title="Micrófono Activo" />
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* PIP MUESTRA CÁMARA DEL INTERLOCUTOR AL ESTAR INTERCAMBIADO */
                !isCounterpartConnected ? (
                  <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
                    <div className="relative mb-1">
                      <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60 opacity-60">
                        {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                          <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(counterpartName)
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-amber-500" title="Desconectado" />
                    </div>
                    <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
                    <span className="text-[10px] text-amber-400 font-semibold mt-0.5">Desconectado</span>
                  </div>
                ) : isCounterpartVideoOff ? (
                  /* PIP CÁMARA DEL INTERLOCUTOR APAGADA */
                  <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
                    <div className="relative mb-1">
                      <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60">
                        {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                          <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(counterpartName)
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-[#00A69D]" title="Conectado" />
                    </div>
                    <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
                    {isCounterpartMuted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
                  </div>
                ) : (
                  /* PIP CÁMARA DEL INTERLOCUTOR PRENDIDA: CONTENEDOR LIMPIO CON NOMBRE E ÍCONO DE MICRÓFONO ABAJO EN PEQUEÑO */
                  <div className="w-full h-full relative bg-slate-900 flex items-center justify-center p-2 overflow-hidden rounded-xl">
                    {remoteCameraTrack && remoteCameraTrack.publication?.track ? (
                      <VideoTrack trackRef={remoteCameraTrack} className="absolute inset-0 w-full h-full object-cover" disablePictureInPicture={true} translate="no" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs mb-1 overflow-hidden shadow-md border border-slate-700/60 animate-pulse">
                          {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                            <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(counterpartName)
                          )}
                        </div>
                        <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
                        {isCounterpartMuted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 z-10 font-bold text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 max-w-[150px]">
                      <span className="truncate">{counterpartName}</span>
                      {isCounterpartMuted ? (
                        <MicOff size={11} className="text-red-400 flex-shrink-0" title="Micrófono Desactivado" />
                      ) : (
                        <Mic size={11} className="text-white/80 flex-shrink-0" title="Micrófono Activo" />
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* OVERLAY FLOTANTE DE SUBTÍTULOS EN TIEMPO REAL CON ARRASTRE MULTIANCLAJE Y PREVENCIÓN DE COLISIÓN */}
            {isVideoSubtitlesEnabled && subtitlesList.length > 0 && (
              <div
                ref={subCardRef}
                onMouseDown={handleMouseDownSub}
                style={getSubtitleAnchorStyle()}
                className={`absolute z-30 max-w-[85%] sm:max-w-[70%] bg-slate-800/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl border-2 border-[#00A69D] text-center select-none cursor-grab active:cursor-grabbing transition-all duration-300 pointer-events-auto ${
                  isDraggingSub ? "scale-105 border-[3.5px] border-[#00C7C0]" : ""
                }`}
                title="Arrastra para mover la barra de subtítulos a cualquier posición de la pantalla"
              >
                <span className="text-[11px] text-[#00C7C0] font-bold uppercase tracking-wider block mb-1">
                  {subtitlesList[subtitlesList.length - 1].speaker_name}
                </span>
                <p className={`leading-snug text-white ${
                  subtitleSizeSetting === "Pequeño"
                    ? "text-sm font-medium"
                    : subtitleSizeSetting === "Grande"
                    ? "text-2xl font-extrabold tracking-wide"
                    : "text-lg font-bold"
                }`}>
                  {subtitlesList[subtitlesList.length - 1].text}
                </p>
              </div>
            )}
          </div>

          {/* BARRA DE CONTROLES INFERIOR (BOTONES REDONDEADOS CON ESTILO MÉDICO ESTÁNDAR) */}
          <div className="flex items-center justify-center gap-3 py-3 px-6 bg-white rounded-2xl border border-gray-200 shadow-sm flex-wrap">
            <button
              onClick={handleToggleMic}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border shadow-sm ${muted
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-white text-gray-700 border-gray-100 hover:bg-gray-50"
                }`}
              title={muted ? "Activar micrófono" : "Desactivar micrófono"}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>Micrófono</span>
            </button>

            <button
              onClick={handleToggleCamera}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                !hasCameraDevice
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                  : videoOff
                    ? "bg-red-50 text-red-600 border-red-200 cursor-pointer"
                    : "bg-white text-gray-700 border-gray-100 hover:bg-gray-50 cursor-pointer"
              }`}
              title={
                !hasCameraDevice
                  ? "Sin cámara detectada en este equipo"
                  : videoOff ? "Activar cámara" : "Desactivar cámara"
              }
            >
              <VideoOff size={16} className={!hasCameraDevice ? "text-gray-400" : videoOff ? "text-red-600" : "text-gray-600"} />
              <span>{!hasCameraDevice ? "Sin cámara" : "Cámara"}</span>
            </button>

            <button
              onClick={() => setActiveTab("subtitles")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border shadow-sm ${activeTab === "subtitles"
                ? "bg-[#F0FFFE] text-[#00A69D] border-[#CCFBF6]"
                : "bg-white text-gray-700 border-gray-100 hover:bg-gray-50"
                }`}
            >
              <Captions size={16} />
              <span>Subtítulos Clínicos</span>
            </button>

            {role === "patient" && isLsaEnabledInSettings && (
              <button
                onClick={() => setLseMode(!lseMode)}
                title="Activar/Desactivar traductor"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border shadow-sm hover:bg-gray-50 ${lseMode
                    ? "bg-[#F0FFFE] text-[#00A69D] border-[#CCFBF6]"
                    : "bg-white text-gray-700 border-gray-100"
                  }`}
              >
                <Hand size={16} />
                <span>Traductor LSA</span>
              </button>
            )}

            <div className="h-5 w-px bg-gray-200 mx-1" />

            <button
              onClick={handleFinishCall}
              disabled={isEndingCall}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white font-semibold text-sm transition-all shadow-sm border ml-2 ${isEndingCall ? 'bg-red-400 border-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 border-red-600 cursor-pointer'}`}
            >
              <PhoneOff size={16} />
              <span>{isEndingCall ? "Finalizando..." : (role === "doctor" ? "Finalizar Teleconsulta" : "Salir de Teleconsulta")}</span>
            </button>
          </div>

        </div>

        {/* SIDEBAR PANEL (CHAT / SUBTÍTULOS / RECETA / NOTAS - ESTILO TARJETAS MÉDICAS UNIFICADAS) */}
        {isSidebarOpen && (
          <div className="w-full sm:w-[500px] lg:w-[600px] bg-white border border-gray-200 rounded-2xl flex flex-col flex-shrink-0 z-20 overflow-hidden shadow-sm">

            {/* TABS NAVEGACIÓN */}
            <div className="flex border-b border-gray-200 bg-gray-50/80 p-1.5 gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("subtitles")}
                className={`flex-1 py-3 px-3 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "subtitles"
                  ? "bg-white text-[#203A70] shadow-xs border border-gray-200"
                  : "text-gray-500 hover:text-[#203A70]"
                  }`}
              >
                <Captions size={18} /> Subtítulos ({subtitlesList.length})
              </button>

              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-3 px-3 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "chat"
                  ? "bg-white text-[#203A70] shadow-xs border border-gray-200"
                  : "text-gray-500 hover:text-[#203A70]"
                  }`}
              >
                <MessageSquare size={18} /> Chat ({chatMessages.length})
              </button>

              {role === "doctor" && (
                <>
                  <button
                    onClick={() => setActiveTab("rx")}
                    className={`flex-1 py-3 px-3 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "rx"
                      ? "bg-white text-[#203A70] shadow-xs border border-gray-200"
                      : "text-gray-500 hover:text-[#203A70]"
                      }`}
                  >
                    <Pill size={18} /> Receta
                  </button>
                  <button
                    onClick={() => setActiveTab("notes")}
                    className={`flex-1 py-3 px-3 text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "notes"
                      ? "bg-white text-[#203A70] shadow-xs border border-gray-200"
                      : "text-gray-500 hover:text-[#203A70]"
                      }`}
                  >
                    <FileText size={18} /> Notas
                  </button>
                </>
              )}
            </div>

            {/* CONTENIDO TAB 1: CHAT INTERACTIVO */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 modern-scroll">
                  {chatMessages.length === 0 ? (
                    <div className="text-[#6B7280] text-sm text-center py-12 px-6 space-y-3">
                      <MessageSquare size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-gray-700 text-base">No hay mensajes aún</p>
                      <p className="text-sm text-gray-400 leading-relaxed px-4">
                        Escribe un mensaje abajo para interactuar en vivo en esta teleconsulta.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.sender === userName ? "items-end" : "items-start"}`}
                      >
                        {msg.sender !== userName && (
                          <span className="text-sm font-bold text-gray-700 mb-1 ml-1">{msg.sender}</span>
                        )}
                        <div
                          className={`p-3 rounded-2xl text-base max-w-[85%] leading-relaxed ${msg.sender === userName
                            ? "bg-[#00A69D] text-white rounded-tr-xs shadow-xs font-medium"
                            : "bg-gray-100 text-gray-800 rounded-tl-xs border border-gray-200 shadow-xs font-medium"
                            }`}
                        >
                          {msg.text}
                        </div>
                        <span className={`text-[11px] text-gray-400 mt-1 ${msg.sender === userName ? "mr-1" : "ml-1"}`}>
                          {msg.time}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* CAMPO DE ENVÍO CHAT */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Escribe un comentario en vivo..."
                    className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-base text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white transition-all placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="w-12 h-12 rounded-2xl bg-[#00A69D] hover:bg-[#008C84] text-white transition-all shadow-xs flex items-center justify-center cursor-pointer flex-shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 2: SUBTÍTULOS / TRANCRIPCIÓN EN TIEMPO REAL */}
            {activeTab === "subtitles" && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white">
                <h3 className="flex items-center gap-2 text-xl text-[#203A70] font-bold mb-4">
                  <Captions size={24} className="text-[#00A69D]" /> Subtítulos Clínicos
                </h3>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 modern-scroll" ref={subtitlesContainerRef}>
                  {subtitlesList.length === 0 ? (
                    <div className="text-[#6B7280] text-sm text-center py-12 px-6 space-y-3">
                      <Captions size={36} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-gray-700 text-base">Esperando transcripción en tiempo real...</p>
                      <p className="text-sm text-gray-400 leading-relaxed px-4">
                        Las transcripciones automáticas de voz aparecerán aquí en cuadros estructurados con la foto de perfil, rol y la hora exacta (hora, minuto y segundo) en que habla cada participante.
                      </p>
                    </div>
                  ) : (
                    subtitlesList.map((sub) => (
                      <div key={sub.id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 shadow-2xs space-y-2 anim-fade-in-up">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                              {sub.speaker_avatar && (sub.speaker_avatar.startsWith("http") || sub.speaker_avatar.startsWith("data:")) ? (
                                <img src={sub.speaker_avatar} alt={sub.speaker_name} className="w-full h-full object-cover" />
                              ) : (
                                getInitials(sub.speaker_name)
                              )}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-base text-[#203A70] block truncate">{sub.speaker_name}</span>
                              <span className="text-sm text-gray-400 capitalize block">{sub.speaker_role === "doctor" ? "Médico Especialista" : "Paciente"}</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400 font-semibold bg-white px-2 py-0.5 rounded-md border border-gray-200 flex-shrink-0">
                            {sub.timestamp}
                          </span>
                        </div>
                        <div className={`${
                          subtitleSizeSetting === "Pequeño"
                            ? "text-sm font-normal"
                            : subtitleSizeSetting === "Grande"
                            ? "text-xl font-bold"
                            : "text-base font-normal"
                        } leading-relaxed p-3 rounded-lg border ${sub.is_draft ? 'text-gray-500 bg-gray-50 border-dashed border-gray-300 italic' : 'text-gray-800 bg-white border-gray-100'}`}>
                          {sub.text}
                          {sub.is_draft && <span className="ml-2 inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse" />}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={subtitlesEndRef} />
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 3: RECETA MÉDICA RÁPIDA (DOCTOR) */}
            {activeTab === "rx" && role === "doctor" && (
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 modern-scroll bg-white">
                <h3 className="flex items-center gap-2 text-[15px] text-[#203A70] font-bold mb-4">
                  <Pill size={18} className="text-[#00A69D]" /> Emisión de Receta Digital Rápida
                </h3>

                {rxSubmitted ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center space-y-2">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                    <p className="font-bold text-[#203A70]">¡Receta emitida exitosamente!</p>
                    <p className="text-[11px] text-gray-600">El paciente ya puede visualizar su receta en su portal médico.</p>
                    <button
                      onClick={() => setRxSubmitted(false)}
                      className="mt-1 text-xs underline font-bold text-[#00A69D] hover:text-[#008C84] cursor-pointer"
                    >
                      Emitir otra receta
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEmitPrescription} className="space-y-3 text-xs">
                    <div className="relative">
                      <label className="block text-gray-700 font-bold mb-1">Medicamento</label>
                      <input
                        type="text"
                        value={rxForm.medicine}
                        onFocus={() => setShowRxMedSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowRxMedSuggestions(false), 150)}
                        onChange={(e) => {
                          setRxForm({ ...rxForm, medicine: e.target.value });
                          setShowRxMedSuggestions(true);
                        }}
                        placeholder="Ej: Losartán 50mg, Omeprazol 20mg..."
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-[13.5px] text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white transition-all placeholder:text-gray-400"
                        required
                      />

                      {showRxMedSuggestions && rxForm.medicine.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 z-50 modern-scroll">
                          {ragMedicines
                            .filter((m) => m.name.toLowerCase().includes(rxForm.medicine.toLowerCase().trim()))
                            .map((sug) => (
                              <button
                                key={sug.name}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setRxForm({
                                    ...rxForm,
                                    medicine: sug.name,
                                    dose: rxForm.dose || sug.defaultDose,
                                    frequency: rxForm.frequency || sug.defaultFreq,
                                  });
                                  setShowRxMedSuggestions(false);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 text-xs flex items-center justify-between text-gray-700 transition-colors cursor-pointer"
                              >
                                <span className="font-bold text-[#203A70] flex items-center gap-2">
                                  <Pill size={13} className="text-[#00A69D]" /> {sug.name}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Dosis</label>
                      <input
                        type="text"
                        value={rxForm.dose}
                        onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                        placeholder="Ej: 500mg, 1 comprimido"
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-[13.5px] text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white transition-all placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Frecuencia / Duración</label>
                      <input
                        type="text"
                        value={rxForm.frequency}
                        onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                        placeholder="Ej: Cada 8 horas por 7 días"
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-[13.5px] text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white transition-all placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Válida hasta (Opcional)</label>
                      <input
                        type="date"
                        value={rxForm.expires_at_date}
                        onChange={(e) => setRxForm({ ...rxForm, expires_at_date: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-[13.5px] text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white transition-all placeholder:text-gray-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isEmittingRx}
                      className="w-full py-3.5 rounded-2xl bg-[#00A69D] hover:bg-[#008C84] text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-5"
                    >
                      <Pill size={15} />
                      <span>{isEmittingRx ? "Emitiendo..." : "Emitir Receta"}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* CONTENIDO TAB 3: NOTAS CLÍNICAS (DOCTOR) */}
            {activeTab === "notes" && role === "doctor" && (
              <div className="flex-1 p-4 overflow-y-auto space-y-3 modern-scroll bg-white">
                <h3 className="flex items-center gap-2 text-[18px] text-[#203A70] font-bold mb-2">
                  <FileText size={20} className="text-[#00A69D]" /> Notas Clínicas
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Escribe las observaciones principales de la consulta. Al finalizar la cita, se guardarán automáticamente en el expediente del paciente.
                </p>

                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Ej: Paciente acude a revisión de analíticas. Se observa presión arterial controlada..."
                  className="w-full h-52 px-4 py-4 rounded-2xl bg-gray-50 border border-gray-200 text-base text-gray-800 outline-none focus:border-[#00A69D] focus:bg-white resize-none transition-all placeholder:text-gray-400"
                />
              </div>
            )}

          </div>
        )}

      </div>

      {/* ─── MODAL TELECONSULTA FINALIZADA POR EL MÉDICO ─── */}
      {isEndedByDoctor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-extrabold text-[#203A70] mb-1.5">Teleconsulta Finalizada</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              El médico ha concluido la consulta clínica. Las notas y recetas médicas han sido guardadas en tu expediente.
            </p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-3">
              <div className="bg-[#00A69D] h-full" style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-gray-400 font-medium">Redirigiendo a tu portal médico...</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function FloatingRoomContent({
  counterpartAvatar,
  counterpartName,
  getInitials
}: any) {
  const remoteParticipants = useRemoteParticipants();
  const isCounterpartConnected = remoteParticipants.length > 0;

  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const audioTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  const remoteCameraTrack = cameraTracks.find(t => !t.participant.isLocal);
  const remoteAudioTrack = audioTracks.find(t => !t.participant.isLocal);

  const isCounterpartVideoOff = !remoteCameraTrack || !remoteCameraTrack.publication || remoteCameraTrack.publication.isMuted || remoteCameraTrack.publication.isSubscribed === false || remoteCameraTrack.participant?.isCameraEnabled === false;
  const isCounterpartMuted = !remoteAudioTrack || !remoteAudioTrack.publication || remoteAudioTrack.publication.isMuted || remoteAudioTrack.participant?.isMicrophoneEnabled === false;

  if (!isCounterpartConnected) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
        <div className="relative mb-1">
          <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60 opacity-60">
            {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
              <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
            ) : (
              getInitials(counterpartName)
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-amber-500" title="Desconectado" />
        </div>
        <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
        <span className="text-[10px] text-amber-400 font-semibold mt-0.5">Desconectado</span>
      </div>
    );
  }

  if (isCounterpartVideoOff) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
        <div className="relative mb-1">
          <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60">
            {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
              <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
            ) : (
              getInitials(counterpartName)
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-[#00A69D]" title="Conectado" />
        </div>
        <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
        {isCounterpartMuted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
      {remoteCameraTrack && remoteCameraTrack.publication?.track ? (
        <VideoTrack trackRef={remoteCameraTrack} className="absolute inset-0 w-full h-full object-cover" disablePictureInPicture={true} translate="no" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
          <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60 animate-pulse">
            {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
              <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
            ) : (
              getInitials(counterpartName)
            )}
          </div>
          <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
          {isCounterpartMuted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 z-10 font-bold text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 max-w-[150px]">
        <span className="truncate">{counterpartName}</span>
        {isCounterpartMuted && <MicOff size={10} className="text-red-400" />}
      </div>
    </div>
  );
}

