import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import {
  Video, Mic, MicOff, VideoOff, Phone, MapPin, Pill,
  Hand, Captions, Volume2, Sparkles, MessageSquare, Plus, Trash2, PanelLeft, Send, User
} from "lucide-react";
import { FarmaciasMapaView } from "./FarmaciasMapaView";
import { PatientHome } from "./PatientHome";
import { SettingsView } from "./SettingsView";

const logoIconImg = new URL("../../imports/image-2.png", import.meta.url).href;

type View = string;

interface PatientDashboardProps {
  userName: string;
  userAvatar?: string;
  currentView: View;
  onNavigate?: (view: string) => void;
}

const prescriptions = [
  { id: "RX-001", medicine: "Atorvastatina 20mg", doctor: "Dr. Carlos Mendoza", doses: "1 vez al día · Noche", status: "activa" },
  { id: "RX-002", medicine: "Metformina 500mg", doctor: "Dra. Ana Torres", doses: "2 veces al día · Con comidas", status: "activa" },
  { id: "RX-003", medicine: "Losartán 50mg", doctor: "Dr. Carlos Mendoza", doses: "1 vez al día · Mañana", status: "vencida" },
];

const subtitleLines = [
  "Buenos días María, ¿cómo ha sentido su presión arterial esta semana?",
  "El médico pregunta si ha tomado su medicación regularmente.",
  "¿Ha tenido mareos o dolores de cabeza en los últimos días?",
  "Veo que sus signos vitales están dentro del rango normal.",
  "Le voy a ajustar la dosis de Losartán a 25mg por las mañanas.",
];

const gestureLabels = [
  "🤟 Señal detectada: DOLOR",
  "🤟 Señal detectada: CABEZA",
  "🤟 Señal detectada: TRES DÍAS",
  "🤟 Señal detectada: MEDICAMENTO",
  "🤟 Señal detectada: SÍ / CONFIRMACIÓN",
];

export function PatientDashboard({ userName, userAvatar, currentView, onNavigate }: PatientDashboardProps) {
  const [pharmacyMedicine, setPharmacyMedicine] = useState<string | null>(null);
  const [lastView, setLastView] = useState(currentView);
  if (currentView !== lastView) { setLastView(currentView); setPharmacyMedicine(null); }

  const navigate = (v: string) => { onNavigate?.(v); };

  if (pharmacyMedicine) {
    return <FarmaciasMapaView medicine={pharmacyMedicine} onBack={() => setPharmacyMedicine(null)} />;
  }
  if (currentView === "home" || currentView === "dashboard") return <PatientHome userName={userName} onNavigate={navigate} />;
  if (currentView === "teleconsult") return <TelemedicinaSala userName={userName} />;
  if (currentView === "prescriptions" || currentView === "pharmacy") return <RecetasYFarmacia onFindPharmacy={(med) => setPharmacyMedicine(med)} />;
  if (currentView === "appointments") return <CitasView />;
  if (currentView === "ai-assistant") return <AsistenteView userName={userName} userAvatar={userAvatar} />;
  if (currentView === "settings") return <SettingsView role="patient" userName={userName} />;
  return <PatientHome userName={userName} onNavigate={navigate} />;
}

/* ─── SALA DE TELEMEDICINA — ancho completo, sin panel lateral ─── */
function TelemedicinaSala({ userName }: { userName: string }) {
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [signsMode, setSignsMode] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [gestureIdx, setGestureIdx] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    if (!inCall) return;
    const t1 = setInterval(() => setSubtitleIdx((i) => (i + 1) % subtitleLines.length), 4000);
    const t2 = setInterval(() => setGestureIdx((i) => (i + 1) % gestureLabels.length), 3200);
    const t3 = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [inCall]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col min-h-screen anim-fade-in" style={{ background: "#F9FAFB" }}>
      <div className="flex flex-col p-6 gap-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
          <div>
            <h1 style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>
              Sala de Telemedicina Inclusiva
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
              Hola <strong>{userName}</strong> · Usa lenguaje de señas frente a la cámara
            </p>
          </div>
          {inCall && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm"
              style={{ background: "#10B981", fontWeight: 700 }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
              EN CONSULTA · {formatTime(elapsedSecs)}
            </div>
          )}
        </div>

        {/* Botones de acceso rápido — solo cuando no hay llamada */}
        {!inCall && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: <Video size={26} />, label: "Iniciar Consulta", action: () => setInCall(true), active: true },
              { icon: <Hand size={26} />, label: signsMode ? "Señas LSE: ON" : "Modo Señas LSE", action: () => setSignsMode(!signsMode), active: signsMode },
              { icon: <Captions size={26} />, label: subtitlesOn ? "Subtítulos: ON" : "Activar Subtítulos", action: () => setSubtitlesOn(!subtitlesOn), active: subtitlesOn },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                className="flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl transition-all duration-200"
                style={{
                  background: btn.active ? "#00A69D" : "white",
                  color: btn.active ? "white" : "#203A70",
                  minHeight: "90px",
                  fontWeight: 700,
                  fontSize: "15px",
                  boxShadow: btn.active
                    ? "0 4px 14px rgba(0,166,157,0.30)"
                    : "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* VIDEO — 100% ancho, altura máxima */}
        <div
          className="relative rounded-xl overflow-hidden w-full"
          style={{
            background: "#0d1a2e",
            minHeight: inCall ? "420px" : "260px",
          }}
        >
          {/* Cámara del paciente */}
          <div className="absolute inset-0 flex items-center justify-center">
            {videoOff ? (
              <div className="text-center">
                <VideoOff size={56} color="rgba(255,255,255,0.3)" />
                <p className="text-white mt-3" style={{ fontWeight: 600 }}>Cámara desactivada</p>
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center relative"
                style={{ background: "linear-gradient(135deg, #1a2744 0%, #0d1a2e 100%)" }}
              >
                <div className="text-center">
                  <div
                    className="w-28 h-28 rounded-full flex items-center justify-center text-white mx-auto mb-3"
                    style={{ background: "#203A70", fontSize: "42px", fontWeight: 800 }}
                  >
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-white text-lg" style={{ fontWeight: 600 }}>{userName}</p>
                  <p className="text-blue-300 text-sm">📷 Tu cámara frontal · Lenguaje de Señas</p>
                </div>

                {inCall && (
                  <div
                    className="absolute top-4 left-4 px-3 py-2 rounded-xl text-sm"
                    style={{ background: "rgba(0,166,157,0.9)", color: "white", fontWeight: 600 }}
                  >
                    {gestureLabels[gestureIdx]}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Badge cámara */}
          <div
            className="absolute top-4 right-4 px-3 py-1.5 rounded-xl text-xs"
            style={{ background: "rgba(0,0,0,0.65)", color: "#00C7C0", fontWeight: 700 }}
          >
            📷 TU CÁMARA — Área de señas LSE
          </div>

          {/* Cámara del médico — pip */}
          {inCall && (
            <div
              className="absolute bottom-4 right-4 rounded-xl overflow-hidden"
              style={{ width: "148px", height: "104px", background: "#1e3a5f", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", border: "2px solid #00A69D" }}
            >
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm mb-1" style={{ background: "#00A69D", fontWeight: 700 }}>CM</div>
                <p className="text-white text-xs" style={{ fontWeight: 600 }}>Dr. Mendoza</p>
                <p className="text-blue-300 text-xs">● Conectado</p>
              </div>
            </div>
          )}

          {/* Estado sin llamada */}
          {!inCall && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(13,26,46,0.85)" }}
            >
              <Video size={48} color="rgba(255,255,255,0.4)" />
              <p className="text-white text-lg" style={{ fontWeight: 600 }}>Cámara lista · Sin consulta activa</p>
              <button
                onClick={() => setInCall(true)}
                className="flex items-center gap-3 px-8 py-4 rounded-xl text-white"
                style={{ background: "#00A69D", fontWeight: 800, fontSize: "18px", boxShadow: "0 4px 16px rgba(0,166,157,0.4)" }}
              >
                <Phone size={22} color="white" /> Iniciar Consulta Ahora
              </button>
            </div>
          )}
        </div>

        {/* Panel de subtítulos — ancho completo, sin borde duro */}
        <div
          className="rounded-xl p-5 w-full"
          style={{
            background: "white",
            boxShadow: inCall ? "0 0 0 2px #00A69D, 0 4px 16px rgba(0,166,157,0.10)" : "0 1px 4px rgba(0,0,0,0.07)",
            minHeight: "100px",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Captions size={20} style={{ color: "#00A69D" }} />
              <span className="text-sm" style={{ color: "#203A70", fontWeight: 700 }}>
                Subtítulos en Tiempo Real — IA
              </span>
              {inCall && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}
                >
                  ● Activo
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: "#9CA3AF" }}>
              <Volume2 size={14} />
              Español · LSE
            </div>
          </div>

          <div
            className="w-full flex items-center px-4 py-4 rounded-xl"
            style={{ background: "#F9FAFB", minHeight: "64px" }}
          >
            {inCall ? (
              <p style={{ color: "#111827", fontSize: "20px", fontWeight: 600, lineHeight: 1.5, letterSpacing: "-0.2px" }}>
                "{subtitleLines[subtitleIdx]}"
              </p>
            ) : (
              <p style={{ color: "#9CA3AF", fontSize: "18px", fontStyle: "italic" }}>
                Los subtítulos aparecerán aquí durante la consulta...
              </p>
            )}
          </div>
        </div>

        {/* Controles de llamada */}
        {inCall && (
          <div className="flex items-center justify-center gap-4 py-1">
            {[
              {
                icon: muted ? <MicOff size={24} /> : <Mic size={24} />,
                label: muted ? "Activar" : "Silencio",
                action: () => setMuted(!muted),
                danger: muted,
              },
              {
                icon: <Phone size={26} />,
                label: "Finalizar",
                action: () => { setInCall(false); setElapsedSecs(0); },
                end: true,
              },
              {
                icon: videoOff ? <VideoOff size={24} /> : <Video size={24} />,
                label: videoOff ? "Activar" : "Cámara",
                action: () => setVideoOff(!videoOff),
                danger: videoOff,
              },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                className="flex flex-col items-center gap-1.5 rounded-xl transition-all"
                style={{
                  background: (btn as any).end ? "#EF4444" : (btn as any).danger ? "#FEE2E2" : "white",
                  color: (btn as any).end ? "white" : (btn as any).danger ? "#EF4444" : "#203A70",
                  padding: (btn as any).end ? "12px 32px" : "12px 20px",
                  minWidth: (btn as any).end ? "100px" : "80px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                {btn.icon}
                <span className="text-xs" style={{ fontWeight: 600 }}>{btn.label}</span>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── RECETAS ─── */
function RecetasYFarmacia({ onFindPharmacy }: { onFindPharmacy: (medicine: string) => void }) {
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRx() {
      try {
        const data = await api.getPrescriptions();
        const formatted = data.map((rx: any) => ({
          id: rx.id,
          medicine: rx.medicine,
          doctor: rx.doctor_name,
          doses: `${rx.dose} · ${rx.frequency}`,
          status: rx.status
        }));
        setPrescriptionsList(formatted);
      } catch (err) {
        console.error("Error cargando recetas:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRx();
  }, []);

  return (
    <div className="p-6 space-y-5 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>Mis Recetas</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 anim-fade-in-up anim-d-1">
        {loading ? (
          <div className="col-span-full text-center py-8 text-gray-500 text-sm">Cargando recetas médicas...</div>
        ) : prescriptionsList.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 text-sm">No tienes recetas médicas asignadas.</div>
        ) : (
          prescriptionsList.map((rx, rxIdx) => (
          <div
            key={rx.id}
            className="bg-white rounded-xl p-5 anim-fade-in-up"
            style={{
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              opacity: rx.status === "vencida" ? 0.65 : 1,
              animationDelay: `${120 + rxIdx * 60}ms`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#F0FFFE" }}>
                <Pill size={22} style={{ color: rx.status === "activa" ? "#00A69D" : "#9CA3AF" }} />
              </div>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: rx.status === "activa" ? "#DCFCE7" : "#F3F4F6",
                  color: rx.status === "activa" ? "#10B981" : "#9CA3AF",
                  fontWeight: 600,
                }}
              >
                {rx.status === "activa" ? "✓ Activa" : "✗ Vencida"}
              </span>
            </div>
            <p style={{ color: "#203A70", fontWeight: 700 }}>{rx.medicine}</p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>{rx.doctor}</p>
            <p className="text-sm mt-0.5" style={{ color: "#00A69D", fontWeight: 500 }}>{rx.doses}</p>
            {rx.status === "activa" && (
              <button
                  onClick={() => onFindPharmacy(rx.medicine)}
                className="w-full mt-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-white text-sm"
                style={{ background: "#00A69D", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,166,157,0.25)" }}
              >
                <MapPin size={15} /> Ver Farmacias Cercanas
              </button>
            )}
          </div>
        )))
      }
      </div>
    </div>
  );
}

/* ─── CITAS ─── */
function CitasView() {
  return (
    <div className="p-6 space-y-4 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>Mis Citas Médicas</h1>
      {[
        { doctor: "Dr. Carlos Mendoza", specialty: "Cardiología", date: "Hoy 15:30", status: "confirmada", avatar: "CM" },
        { doctor: "Dra. Ana Torres", specialty: "Neurología", date: "Vie 18 Jul, 10:00", status: "pendiente", avatar: "AT" },
      ].map((apt, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-5 flex items-center gap-4 anim-fade-in-up"
          style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)", animationDelay: `${i * 80}ms` }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "#203A70", fontWeight: 800 }}>{apt.avatar}</div>
          <div className="flex-1">
            <p style={{ color: "#203A70", fontWeight: 700 }}>{apt.doctor}</p>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{apt.specialty} · {apt.date}</p>
          </div>
          <span
            className="px-3 py-1.5 rounded-xl text-xs"
            style={{
              background: apt.status === "confirmada" ? "#DCFCE7" : "#FEF3C7",
              color: apt.status === "confirmada" ? "#10B981" : "#D97706",
              fontWeight: 600,
            }}
          >
            {apt.status === "confirmada" ? "✓ Confirmada" : "⏳ Pendiente"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── ASISTENTE IA ─── */
const allSuggestions = [
  { icon: "📅", text: "¿Cuándo es mi próxima cita?" },
  { icon: "📝", text: "Resumen de mi última cita" },
  { icon: "💊", text: "Explicar mi receta actual" },
  { icon: "⏳", text: "¿Tengo citas pendientes?" },
  { icon: "📋", text: "Mis medicamentos actuales" },
  { icon: "👨‍⚕️", text: "¿Con qué doctor me toca?" },
  { icon: "📜", text: "Validez de mis recetas" },
  { icon: "🗂️", text: "Historial de mis consultas" }
];

const TypewriterMessage = ({ text, animate }: { text: string, animate: boolean }) => {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  useEffect(() => {
    if (!animate) { setDisplayed(text); return; }
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i += 2; // velocidad de escritura
      if (i > text.length) {
        setDisplayed(text);
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text, animate]);
  return <>{displayed}</>;
};

function AsistenteView({ userName, userAvatar }: { userName?: string; userAvatar?: string }) {
  const [randomSuggestions, setRandomSuggestions] = useState<{icon: string, text: string}[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem("aiActiveSessionId");
    return saved ? (saved === "new" ? null : Number(saved)) : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = sessionStorage.getItem("aiSidebarOpen");
    return saved !== null ? saved === "true" : true;
  });
  const skipFetchRef = useRef(false);
  const isSendingRef = useRef(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ from: string; text: string; isNew?: boolean }[]>([]);
  const [typing, setTyping] = useState(false);
  const msgsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sessionStorage.setItem("aiActiveSessionId", activeSessionId === null ? "new" : activeSessionId.toString());
  }, [activeSessionId]);

  useEffect(() => {
    sessionStorage.setItem("aiSidebarOpen", isSidebarOpen.toString());
  }, [isSidebarOpen]);

  useEffect(() => {
    api.getChatSessions().then(data => {
      setSessions(data);
      const saved = sessionStorage.getItem("aiActiveSessionId");
      if (!saved && data.length > 0) {
        setActiveSessionId(data[0].id);
      }
    }).catch(console.error);
    
    // Pick 3 random suggestions
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
    setRandomSuggestions(shuffled.slice(0, 3));
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }
      api.getChatSessionById(activeSessionId).then(data => {
        if (data.messages) {
          setMsgs(data.messages.map((m: any) => ({
            from: m.role === "assistant" ? "bot" : "user",
            text: m.content,
            isNew: false
          })));
        } else {
          setMsgs([]);
        }
      }).catch(console.error);
    } else {
      setMsgs([]);
    }
  }, [activeSessionId]);

  const createNewChat = () => {
    setActiveSessionId(null);
    setMsgs([]);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await api.deleteChatSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMsgs([]);
      }
    } catch (err) {
      console.error("Error al borrar sesión", err);
    }
  };

  const send = async (text?: string) => {
    if (isSendingRef.current) return;
    
    const query = (text ?? input).trim();
    if (!query) return;
    
    isSendingRef.current = true;
    setInput("");
    
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
       skipFetchRef.current = true;
       const newSession = await api.createChatSession();
       currentSessionId = newSession.id;
       setActiveSessionId(currentSessionId);
       setSessions(prev => [newSession, ...prev]);
    }

    setMsgs((p) => [...p, { from: "user", text: query, isNew: true }]);
    setTyping(true);

    try {
      const history = msgs.map(m => ({
        role: m.from === "bot" ? "assistant" : "user",
        content: m.text
      }));
      
      const res = await api.queryChatbot(query, currentSessionId, history);
      
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: res.reply, isNew: true }]);
      
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: query.slice(0, 30) + (query.length > 30 ? "..." : "") } : s));
    } catch (err: any) {
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: "Lo siento, hubo un error de conexión con mi cerebro clínico.", isNew: true }]);
    } finally {
      isSendingRef.current = false;
    }
  };

  useEffect(() => {
    if (msgsEndRef.current) {
      msgsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, typing]);

  const isEmpty = msgs.length === 0;

  return (
    <div className="flex h-full relative" style={{ height: "calc(100vh - 66px)", background: "#F9FAFB", overflow: "hidden" }}>
      
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-4 left-4 z-50 bg-white p-2.5 rounded-xl text-gray-500 hover:text-gray-800 transition-all hover:bg-gray-50"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #F3F4F6" }}
        >
          <PanelLeft size={20} />
        </button>
      )}

      {/* Sidebar Historial de Chats */}
      <div 
        className="border-r flex flex-col bg-white transition-all duration-300 overflow-hidden" 
        style={{ 
          width: isSidebarOpen ? "260px" : "0px", 
          opacity: isSidebarOpen ? 1 : 0,
          borderColor: "#F3F4F6",
          flexShrink: 0
        }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6", minWidth: "260px" }}>
          <button 
            onClick={createNewChat}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold transition-all mr-2"
            style={{ background: "#00A69D", boxShadow: "0 2px 10px rgba(0,166,157,0.3)" }}
          >
            <Plus size={18} /> Nuevo Chat
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all flex-shrink-0"
          >
            <PanelLeft size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ minWidth: "260px" }}>
          <p className="text-xs font-bold px-2 py-2" style={{ color: "#9CA3AF" }}>Tus consultas</p>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className="group w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left rounded-lg transition-colors cursor-pointer"
              style={{
                background: activeSessionId === s.id ? "#F3F4F6" : "transparent",
                color: activeSessionId === s.id ? "#203A70" : "#6B7280",
                fontWeight: activeSessionId === s.id ? 700 : 500,
              }}
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <MessageSquare size={15} style={{ opacity: 0.7, flexShrink: 0 }} />
                <span className="text-sm truncate">{s.title}</span>
              </div>
              
              <button 
                onClick={(e) => handleDeleteSession(e, s.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 p-1 rounded hover:bg-red-50"
                title="Borrar chat"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Área Principal del Chat */}
      <div className="flex-1 flex flex-col relative bg-[#FCFCFD]">
        
        {/* Animated Background Orbs */}
        <div className="glowing-orb"></div>
        <div className="glowing-orb-2"></div>
        
        {isEmpty ? (
          <div className="flex-1 flex flex-col relative z-10 w-full h-full">
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 anim-fade-in-up">
              <h1 className="text-center mb-4" style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#203A70" }}>
                Hola, {userName || "Usuario"}
              </h1>
              <p className="text-lg mb-10 text-center" style={{ color: "#6B7280", maxWidth: "500px" }}>
                Mejora tu salud con IA: consultas instantáneas, análisis rápidos y conexión segura.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 w-full z-10 relative modern-scroll pb-40">
            <div className="space-y-6" style={{ maxWidth: "860px", width: "100%", margin: "0 auto" }}>
              {msgs.map((m, i) => (
                <div key={`${activeSessionId}-${i}`} className={`flex gap-4 anim-fade-in-up ${m.from === "user" ? "flex-row-reverse" : ""}`} style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s`, animationFillMode: "both" }}>
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden font-bold" style={{ background: m.from === "bot" ? "transparent" : (userAvatar ? "white" : "#00A69D"), color: m.from === "bot" ? "white" : (userAvatar ? "#6B7280" : "white") }}>
                    {m.from === "bot" ? (
                      <img src={logoIconImg} alt="Bot" className="w-full h-full object-contain" />
                    ) : userAvatar ? (
                      <img src={userAvatar} alt="Tú" className="w-full h-full object-cover" />
                    ) : (
                      userName ? userName.charAt(0).toUpperCase() : "U"
                    )}
                  </div>
                  <div className={`max-w-xl px-6 py-4 text-[15px] ${m.from === 'bot' ? 'glass-panel text-gray-800 rounded-3xl rounded-tl-sm' : 'bg-[#203A70] text-white rounded-3xl rounded-tr-sm shadow-md'}`} style={{ lineHeight: 1.6 }}>
                    {m.from === "bot" ? <TypewriterMessage text={m.text} animate={!!m.isNew} /> : m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden" style={{ background: "transparent", color: "white" }}>
                    <img src={logoIconImg} alt="Bot" className="w-full h-full object-contain" />
                  </div>
                  <div className="glass-panel px-6 py-5 rounded-3xl rounded-tl-sm flex items-center gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="w-2.5 h-2.5 rounded-full animate-bounce inline-block" style={{ background: "#00A69D", animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={(el) => { msgsEndRef.current = el; }} />
            </div>
          </div>
        )}

        {/* Floating Input Area (Shared between empty and chat state) */}
        <div className="absolute bottom-6 left-0 w-full px-4 z-20 flex justify-center pointer-events-none">
          <div className="w-full max-w-4xl flex flex-col pointer-events-auto">
            
            {/* Modern Floating Input */}
            <div className="animated-border-wrapper w-full shadow-2xl transition-all mb-4">
              <div className="animated-border-inner w-full flex flex-col p-4 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={isEmpty ? "Escribe tu consulta o síntoma..." : "Escribe un mensaje..."}
                  className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 resize-none modern-scroll"
                  style={{ fontSize: "16px", minHeight: "72px" }}
                  rows={1}
                  autoFocus
                />
                
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                      <Plus size={20} />
                    </button>
                    <button className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                      <Mic size={20} />
                    </button>
                  </div>
                  <button
                    onClick={() => send()}
                    disabled={!input.trim()}
                    className="p-3 rounded-full text-white shadow-md transition-all disabled:opacity-40 disabled:scale-95 flex items-center justify-center"
                    style={{ background: "#203A70" }}
                  >
                    <Send size={18} style={{ transform: "translate(-1px, 1px)" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestion Cards (Only in empty state, now BELOW) */}
            {isEmpty && (
              <div className="grid grid-cols-3 gap-3 anim-fade-in-up pb-2 w-full">
                {randomSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.text)}
                    className="bg-white/90 backdrop-blur-md rounded-full px-3 py-2.5 shadow-sm border border-gray-100/50 hover:bg-white hover:shadow-md transition-all flex items-center justify-center gap-2 group w-full"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-[13px] font-semibold text-gray-600 group-hover:text-gray-900 transition-colors whitespace-nowrap overflow-hidden text-ellipsis">{s.text}</span>
                  </button>
                ))}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
