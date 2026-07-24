import React, { useState, useEffect, useRef } from "react";
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, 
  Captions, Hand, Send, Pill, FileText, Clock, CheckCircle2, 
  User, ShieldCheck, Minimize2, Maximize2, MapPin
} from "lucide-react";
import { api, getToken } from "../utils/api";

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

export function TelemedicinaRoom({
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
  onEmitRxSuccess
}: TelemedicinaRoomProps) {
  // Call Controls State
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const [lseMode, setLseMode] = useState(false);
  const [showRxMedSuggestions, setShowRxMedSuggestions] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [activeTab, setActiveTab] = useState<"chat" | "rx" | "notes">(role === "doctor" ? "chat" : "chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEndedByDoctor, setIsEndedByDoctor] = useState(false);

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
  const [rxForm, setRxForm] = useState({ medicine: "", dose: "", frequency: "" });
  const [rxSubmitted, setRxSubmitted] = useState(false);
  const [isEmittingRx, setIsEmittingRx] = useState(false);

  // Doctor Clinical Summary
  const [clinicalNotes, setClinicalNotes] = useState("");
  const roomCode = appointmentId ? String(appointmentId) : "global";

  // 1. Single Source of Truth Live Call Timer
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSecs(Math.max(0, elapsed));
      } else {
        setElapsedSecs((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 3. Real-Time Room Presence Tracking (Heartbeat & Dynamic Connection)
  const [isCounterpartConnected, setIsCounterpartConnected] = useState(false);
  const [presenceToast, setPresenceToast] = useState<string | null>(null);
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    const updatePresence = async () => {
      try {
        const now = Date.now();

        // 1. Backend REST presence API call (Cross-browser / cross-tab / multi-device support)
        let apiConnected = false;
        try {
          const res = await fetch(`http://localhost:8000/api/realtime/presence/${roomCode}/${role}`, {
            method: "POST"
          });
          if (res.ok) {
            const data = await res.json();
            apiConnected = Boolean(data.connected);
            if (data.start_time && !startTimeRef.current) {
              startTimeRef.current = Math.floor(data.start_time * 1000);
            }
          }
        } catch (err) {}

        // 2. LocalStorage presence fallback (Same browser tabs)
        const presenceKey = `room_presence_${roomCode}`;
        const rawSpecific = localStorage.getItem(presenceKey);
        const currentSpecific = rawSpecific ? JSON.parse(rawSpecific) : {};

        if (role === "doctor") {
          currentSpecific.doctor = true;
          currentSpecific.doctorTime = now;
        } else {
          currentSpecific.patient = true;
          currentSpecific.patientTime = now;
        }
        localStorage.setItem(presenceKey, JSON.stringify(currentSpecific));

        const counterpartRole = role === "doctor" ? "patient" : "doctor";
        const specTime = currentSpecific[`${counterpartRole}Time`];
        const specOnline = currentSpecific[counterpartRole] === true && specTime && (now - specTime < 6000);

        const isOnline = Boolean(apiConnected || specOnline);

        setIsCounterpartConnected(isOnline);

        if (isOnline && !prevConnectedRef.current) {
          const msg = role === "doctor"
            ? `¡${counterpartName} se ha unido a la teleconsulta!`
            : `¡El ${counterpartName} se ha conectado a la sala!`;
          setPresenceToast(msg);
          setTimeout(() => setPresenceToast(null), 4500);
        } else if (!isOnline && prevConnectedRef.current) {
          const msg = role === "doctor"
            ? `${counterpartName} ha salido de la sala.`
            : `El ${counterpartName} se ha desconectado.`;
          setPresenceToast(msg);
          setTimeout(() => setPresenceToast(null), 4500);
        }

        prevConnectedRef.current = isOnline;

        // 3. Real-time call completion sync for patient
        if (role === "patient") {
          const statusKey = `room_status_${roomCode}`;
          const rawStatus = localStorage.getItem(statusKey);
          if (rawStatus) {
            try {
              const parsedStatus = JSON.parse(rawStatus);
              if (parsedStatus.status === "completada" || parsedStatus.status === "ended") {
                setIsEndedByDoctor(true);
              }
            } catch (e) {}
          }

          if (appointmentId) {
            try {
              const token = getToken();
              const res = await fetch(`http://localhost:8000/api/appointments`, {
                headers: { "Authorization": `Bearer ${token}` }
              });
              if (res.ok) {
                const apts = await res.json();
                const myApt = apts.find((a: any) => a.id === appointmentId);
                if (myApt && myApt.status === "completada") {
                  setIsEndedByDoctor(true);
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error("Error actualizando presencia", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [roomCode, role, counterpartName, appointmentId]);

  // Poll & Load Live Comments from Backend REST API + LocalStorage fallback
  const storageKey = appointmentId ? `teleconsult_comments_${appointmentId}` : `teleconsult_comments_demo`;

  useEffect(() => {
    // Reset chat messages when entering a room to avoid showing previous session chats
    setChatMessages([]);

    const loadComments = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/realtime/comments/${roomCode}`);
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
      } catch (e) {}

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
      } catch (e) {}
    };

    loadComments();
    const interval = setInterval(loadComments, 1500);
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
    const s = (secs % 60).toString().padStart(2, "0");
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
    } catch (e) {}

    try {
      await fetch(`http://localhost:8000/api/realtime/comments/${roomCode}`, {
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
        expires_in_days: 30
      });
      setRxSubmitted(true);
      setRxForm({ medicine: "", dose: "", frequency: "" });
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
        if (clinicalNotes.trim()) {
          await api.summarizeConsultation(appointmentId, clinicalNotes.trim());
        }
        await api.updateAppointmentStatus(appointmentId, "completada");

        // Broadcast room completion locally & via realtime channel
        const statusKey = `room_status_${roomCode}`;
        localStorage.setItem(statusKey, JSON.stringify({ status: "completada", endedBy: "doctor", endedAt: new Date().toISOString() }));

        try {
          await fetch(`http://localhost:8000/api/realtime/comments/${roomCode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: "SISTEMA",
              text: "__ROOM_FINISHED_BY_DOCTOR__",
              time: new Date().toLocaleTimeString("es-DO"),
              role: "system"
            })
          });
        } catch (e) {}
      }
    } catch (err) {
      console.error("Error al finalizar consulta", err);
    } finally {
      onEndCall();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1A2E] text-white overflow-hidden relative" style={{ minHeight: "calc(100vh - 66px)" }}>
      
      {/* ─── BARRA SUPERIOR DE LA SALA ─── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#112239] border-b border-gray-800 flex-wrap gap-2 z-20">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Teleconsulta Médica en Vivo</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00A69D]/20 text-[#00C7C0] border border-[#00A69D]/40 font-semibold">
                SUPER-UCE DOC
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
              <span>{role === "doctor" ? "Paciente:" : "Médico:"} <strong className="text-gray-200">{counterpartName}</strong></span>
              {role === "patient" && counterpartSpecialty && (
                <span className="text-[11px] text-[#00C7C0] font-semibold bg-[#00A69D]/20 px-2 py-0.5 rounded-full border border-[#00A69D]/30">
                  {counterpartSpecialty}
                </span>
              )}
              {appointmentReason && <span className="text-gray-400">· Motivo: {appointmentReason}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            <Clock size={14} />
            <span>EN CONSULTA · {formatTime(elapsedSecs)}</span>
          </div>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <MessageSquare size={16} />
            <span>{isSidebarOpen ? "Ocultar Panel" : "Ver Chat / Notas"}</span>
          </button>
        </div>
      </div>

      {/* ─── CUERPO PRINCIPAL (VIDEO + SIDEBAR) ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* AREA DE VIDEO Y CONTROLES (IZQUIERDA) */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto relative">
          
          {/* GRIDA DE VIDEO */}
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0A1322] border border-gray-800 flex items-center justify-center min-h-[380px]">
            
            {/* TOAST NOTIFICACIÓN EN SALA */}
            {presenceToast && (
              <div className="absolute top-4 z-30 px-4 py-2 rounded-xl bg-[#00A69D] text-white text-xs font-bold shadow-2xl animate-bounce border border-emerald-300">
                {presenceToast}
              </div>
            )}

            {/* VIDEO PARTICIPANTE REMOTO (GRANDE) */}
            <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-br from-[#122238] to-[#0A1322]">
              {isCounterpartConnected ? (
                <>
                  <div className="relative mb-3">
                    <div className="w-28 h-28 rounded-full bg-[#1E3A5F] border-2 border-[#00A69D] text-white flex items-center justify-center font-bold text-3xl shadow-xl overflow-hidden">
                      {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                        <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(counterpartName)
                      )}
                    </div>
                    <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0A1322]" title="Conectado" />
                  </div>

                  <h3 className="text-lg font-bold text-white">{counterpartName}</h3>
                  <p className="text-xs text-cyan-300 font-medium mt-0.5">
                    {role === "doctor" ? "📷 Cámara del Paciente · En Línea" : "👨‍⚕️ Cámara del Médico · En Línea"}
                  </p>

                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>● EN VIVO · CONECTADO</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative mb-3">
                    <div className="w-28 h-28 rounded-full bg-gray-800/80 border-2 border-amber-500/60 text-gray-300 flex items-center justify-center font-bold text-3xl shadow-xl overflow-hidden">
                      {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
                        <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover opacity-50" />
                      ) : (
                        getInitials(counterpartName)
                      )}
                    </div>
                    <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-[#0A1322] animate-ping" title="Esperando..." />
                  </div>

                  <h3 className="text-lg font-bold text-gray-200">{counterpartName}</h3>
                  <p className="text-xs text-amber-300 font-medium mt-1 animate-pulse">
                    {role === "doctor"
                      ? "⏳ Esperando a que el paciente se una a la videollamada..."
                      : "⏳ El médico ha salido temporalmente de la consulta. Esperando a que vuelva a conectarse..."}
                  </p>

                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-xs font-semibold text-amber-400 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>⏳ SALA DE ESPERA EN VIVO</span>
                  </div>
                </>
              )}
            </div>

            {/* VIDEO PROPIO (PIP - ABAJO A LA DERECHA) */}
            <div className="absolute bottom-4 right-4 w-40 h-28 rounded-xl overflow-hidden bg-[#162C4A] border-2 border-[#00A69D] shadow-2xl flex flex-col items-center justify-center z-10">
              {videoOff ? (
                <div className="flex flex-col items-center text-gray-400">
                  <VideoOff size={24} />
                  <span className="text-[10px] mt-1 font-semibold">Cámara OFF</span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-[#1A3356]">
                  <div className="w-10 h-10 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-sm mb-1 overflow-hidden">
                    {userAvatar && (userAvatar.startsWith("http") || userAvatar.startsWith("data:")) ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(userName)
                    )}
                  </div>
                  <span className="text-xs text-white font-bold truncate max-w-[120px]">{userName} (Tú)</span>
                  {muted && <span className="text-[9px] text-red-400 font-bold">Mic silenciado</span>}
                </div>
              )}
            </div>

            {/* AREA DE SUBTÍTULOS / LSE (EN BLANCO PARA IA FUTURA) */}
            {subtitlesOn && (
              <div className="absolute bottom-4 left-4 right-48 px-4 py-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-gray-700 text-center z-10 transition-all">
                <p className="text-xs text-gray-300 font-medium">
                  {lseMode ? "🤟 Modo Lenguaje de Señas LSE Activo · Escuchando cámara frontal..." : "💬 Subtítulos en Tiempo Real · Escuchando audio de consulta..."}
                </p>
              </div>
            )}
          </div>

          {/* BARRA DE CONTROLES INFERIOR */}
          <div className="flex items-center justify-center gap-3 py-2 px-4 bg-[#112239] rounded-2xl border border-gray-800 flex-wrap">
            <button
              onClick={() => setMuted(!muted)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                muted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-gray-800 text-gray-200 hover:bg-gray-700"
              }`}
              title={muted ? "Activar micrófono" : "Silenciar micrófono"}
            >
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
              <span className="text-[11px] font-semibold">{muted ? "Silenciado" : "Mic"}</span>
            </button>

            <button
              onClick={() => setVideoOff(!videoOff)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                videoOff ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-gray-800 text-gray-200 hover:bg-gray-700"
              }`}
              title={videoOff ? "Activar cámara" : "Desactivar cámara"}
            >
              {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
              <span className="text-[11px] font-semibold">{videoOff ? "Sin Cámara" : "Cámara"}</span>
            </button>

            <button
              onClick={() => setSubtitlesOn(!subtitlesOn)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                subtitlesOn ? "bg-[#00A69D]/20 text-[#00C7C0] border border-[#00A69D]/40" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <Captions size={20} />
              <span className="text-[11px] font-semibold">Subtítulos</span>
            </button>

            <button
              onClick={() => setLseMode(!lseMode)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                lseMode ? "bg-[#00A69D]/20 text-[#00C7C0] border border-[#00A69D]/40" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <Hand size={20} />
              <span className="text-[11px] font-semibold">Modo LSE</span>
            </button>

            <button
              onClick={handleFinishCall}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg ml-4"
            >
              <PhoneOff size={18} />
              <span>{role === "doctor" ? "Finalizar Consulta" : "Salir de la Sala"}</span>
            </button>
          </div>

        </div>

        {/* SIDEBAR PANEL (CHAT / RECETA / NOTAS) */}
        {isSidebarOpen && (
          <div className="w-80 sm:w-96 bg-[#112239] border-l border-gray-800 flex flex-col flex-shrink-0 z-20">
            
            {/* TABS NAVEGACIÓN */}
            <div className="flex border-b border-gray-800 bg-[#0E1B2E]">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                  activeTab === "chat" ? "border-[#00A69D] text-[#00C7C0] bg-[#112239]" : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <MessageSquare size={15} /> Chat / Notas ({chatMessages.length})
              </button>

              {role === "doctor" && (
                <>
                  <button
                    onClick={() => setActiveTab("rx")}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                      activeTab === "rx" ? "border-[#00A69D] text-[#00C7C0] bg-[#112239]" : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <Pill size={15} /> Receta Médica
                  </button>
                  <button
                    onClick={() => setActiveTab("notes")}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                      activeTab === "notes" ? "border-[#00A69D] text-[#00C7C0] bg-[#112239]" : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <FileText size={15} /> Resumen
                  </button>
                </>
              )}
            </div>

            {/* CONTENIDO TAB 1: CHAT INTERACTIVO */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-xs">
                      No hay mensajes en esta teleconsulta.<br/>Escribe un comentario abajo para interactuar en vivo.
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.sender === userName ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                          <span className="font-semibold">{msg.sender}</span>
                          <span>· {msg.time}</span>
                        </div>
                        <div
                          className={`p-2.5 rounded-2xl text-xs max-w-[85%] ${
                            msg.sender === userName
                              ? "bg-[#00A69D] text-white rounded-tr-none"
                              : "bg-[#1E3A5F] text-gray-100 rounded-tl-none border border-gray-700"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* CAMPO DE ENVÍO CHAT */}
                <div className="mt-3 pt-3 border-t border-gray-800 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Escribe un comentario en vivo..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#0A1322] border border-gray-700 text-xs text-white outline-none focus:border-[#00A69D]"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="p-2 rounded-xl bg-[#00A69D] hover:opacity-90 text-white transition-opacity flex items-center justify-center"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 2: RECETA MÉDICA RÁPIDA (DOCTOR) */}
            {activeTab === "rx" && role === "doctor" && (
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="flex items-center gap-2 text-xs text-[#00C7C0] font-bold">
                  <Pill size={16} /> Emisión de Receta Digital Rápida
                </div>

                {rxSubmitted ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center space-y-2">
                    <CheckCircle2 size={24} className="mx-auto" />
                    <p className="font-bold">¡Receta emitida exitosamente!</p>
                    <p className="text-[11px] text-gray-300">El paciente ya puede visualizar su receta en su panel y buscar farmacias cercanas.</p>
                    <button
                      onClick={() => setRxSubmitted(false)}
                      className="mt-2 text-xs underline text-[#00C7C0]"
                    >
                      Emitir otra receta
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEmitPrescription} className="space-y-3 text-xs">
                    <div className="relative">
                      <label className="block text-gray-300 font-semibold mb-1">Medicamento</label>
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
                        className="w-full px-3 py-2 rounded-xl bg-[#0A1322] border border-gray-700 text-white outline-none focus:border-[#00A69D]"
                        required
                      />

                      {showRxMedSuggestions && rxForm.medicine.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#0A1322] border-2 border-[#00A69D] rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-gray-800 z-50">
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
                                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs flex items-center justify-between text-gray-200 transition-colors cursor-pointer"
                              >
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  <Pill size={13} className="text-[#00C7C0]" /> {sug.name}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-gray-300 font-semibold mb-1">Dosis</label>
                      <input
                        type="text"
                        value={rxForm.dose}
                        onChange={(e) => setRxForm({ ...rxForm, dose: e.target.value })}
                        placeholder="Ej: 500mg, 1 comprimido"
                        className="w-full px-3 py-2 rounded-xl bg-[#0A1322] border border-gray-700 text-white outline-none focus:border-[#00A69D]"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 font-semibold mb-1">Frecuencia / Duración</label>
                      <input
                        type="text"
                        value={rxForm.frequency}
                        onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                        placeholder="Ej: Cada 8 horas por 7 días"
                        className="w-full px-3 py-2 rounded-xl bg-[#0A1322] border border-gray-700 text-white outline-none focus:border-[#00A69D]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isEmittingRx}
                      className="w-full py-2.5 rounded-xl bg-[#00A69D] hover:opacity-90 text-white font-bold transition-opacity flex items-center justify-center gap-2 shadow-md mt-2"
                    >
                      <Pill size={16} />
                      <span>{isEmittingRx ? "Emitiendo..." : "Emitir Receta"}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* CONTENIDO TAB 3: RESUMEN CLÍNICO (DOCTOR) */}
            {activeTab === "notes" && role === "doctor" && (
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#00C7C0] font-bold">
                  <FileText size={16} /> Resumen de Historia Clínica
                </div>
                <p className="text-[11px] text-gray-400">
                  Escribe las observaciones principales de la consulta. Al finalizar la cita, se guardarán automáticamente en el expediente del paciente.
                </p>

                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Ej: Paciente acude a revisión de analíticas. Se observa presión controlada..."
                  className="w-full h-40 p-3 rounded-xl bg-[#0A1322] border border-gray-700 text-xs text-white outline-none focus:border-[#00A69D] resize-none"
                />
              </div>
            )}

          </div>
        )}

      </div>

      {/* ─── MODAL TELECONSULTA FINALIZADA POR EL MÉDICO ─── */}
      {isEndedByDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md anim-fade-in p-4">
          <div className="bg-[#112239] border border-emerald-500/40 rounded-2xl p-6 text-center max-w-md w-full shadow-2xl anim-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Teleconsulta Finalizada</h3>
            <p className="text-sm text-gray-300 mb-4">
              El médico ha concluido el encuentro clínico. Las notas y recetas médicas han sido procesadas y guardadas en tu expediente.
            </p>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mb-3">
              <div className="bg-[#00C7C0] h-full animate-pulse" style={{ width: "100%" }} />
            </div>
            <p className="text-xs text-gray-400">Redirigiendo a tu portal médico...</p>
          </div>
        </div>
      )}
    </div>
  );
}
