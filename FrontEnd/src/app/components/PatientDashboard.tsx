import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import {
  Video, Mic, MicOff, VideoOff, Phone, MapPin, Pill,
  Hand, Captions, Volume2, Sparkles, MessageSquare, Plus, Trash2, PanelLeft, Send, User, Clock
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { FarmaciasMapaView } from "./FarmaciasMapaView";
import { PatientHome } from "./PatientHome";
import { SettingsView } from "./SettingsView";
import { TelemedicinaRoom } from "./TelemedicinaRoom";

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
  const [activeCallDoc, setActiveCallDoc] = useState<{ name: string; avatar?: string; id?: number } | null>(null);

  if (currentView !== lastView) { setLastView(currentView); setPharmacyMedicine(null); }

  const navigate = (v: string) => { onNavigate?.(v); };

  if (pharmacyMedicine) {
    return <FarmaciasMapaView medicine={pharmacyMedicine} onBack={() => setPharmacyMedicine(null)} />;
  }
  const handleJoinCall = (apt: any) => {
    setActiveCallDoc({ name: apt.doctor_name || apt.name, avatar: apt.doctor_avatar || apt.avatar, id: apt.id });
    navigate("teleconsult");
  };

  if (currentView === "home" || currentView === "dashboard") return <PatientHome userName={userName} onNavigate={navigate} onJoinCall={handleJoinCall} />;
  if (currentView === "teleconsult") return <TelemedicinaSala userName={userName} userAvatar={userAvatar} activeCallDoc={activeCallDoc} onEndCall={() => navigate("appointments")} />;
  if (currentView === "prescriptions" || currentView === "pharmacy") return <RecetasYFarmacia onFindPharmacy={(med) => setPharmacyMedicine(med)} />;
  if (currentView === "appointments") return <CitasView onJoinCall={handleJoinCall} />;
  if (currentView === "ai-assistant") return <AsistenteView userName={userName} userAvatar={userAvatar} />;
  if (currentView === "settings") return <SettingsView role="patient" userName={userName} />;
  return <PatientHome userName={userName} onNavigate={navigate} onJoinCall={handleJoinCall} />;
}

/* ─── SALA DE TELEMEDICINA — unificada y dinámica ─── */
function TelemedicinaSala({ userName, userAvatar, activeCallDoc, onEndCall }: { userName: string; userAvatar?: string; activeCallDoc?: { name: string; avatar?: string; id?: number } | null; onEndCall?: () => void }) {
  return (
    <TelemedicinaRoom
      role="patient"
      userName={userName || "Paciente"}
      userAvatar={userAvatar}
      counterpartName={activeCallDoc?.name || "Dr. Jose Miguel"}
      counterpartAvatar={activeCallDoc?.avatar}
      appointmentId={activeCallDoc?.id}
      onEndCall={() => {
        if (onEndCall) onEndCall();
        else window.history.back();
      }}
    />
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
        if (Array.isArray(data)) {
          const formatted = data.map((rx: any) => ({
            id: rx.id,
            medicine: rx.medicine,
            doctor: rx.doctor_name,
            doses: `${rx.dose} · ${rx.frequency}`,
            status: rx.status
          }));
          setPrescriptionsList(formatted);
        }
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

function formatDateSafe(dateStr?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "Fecha pendiente";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("es-DO", options || { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return String(dateStr);
  }
}

function getInitialsSafe(name?: string): string {
  if (!name || !name.trim()) return "DR";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().substring(0, 2).toUpperCase();
}

function LiveElapsedBadge({ roomCode }: { roomCode: number }) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    const fetchStart = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/realtime/presence/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.start_time) {
            const diff = Math.floor(Date.now() / 1000 - data.start_time);
            setElapsed(Math.max(0, diff));
          }
        }
      } catch (e) {}
    };

    fetchStart();
    const interval = setInterval(fetchStart, 1000);
    return () => clearInterval(interval);
  }, [roomCode]);

  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <span
      className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-cyan-200"
      style={{ background: "#E0F2FE", color: "#0284C7" }}
    >
      <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
      En Curso · {m}:{s}
    </span>
  );
}

/* ─── CITAS ─── */
function CitasView({ onJoinCall }: { onJoinCall?: (apt: any) => void }) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [myDoctors, setMyDoctors] = useState<any[]>([]);
  const [form, setForm] = useState({ doctor_id: "", date: "", time: "", type: "Teleconsulta", reason: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      if (Array.isArray(data)) {
        setAppointmentsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    const interval = setInterval(async () => {
      try {
        const data = await api.getAppointments();
        if (Array.isArray(data)) {
          setAppointmentsList(data);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = async () => {
    setShowModal(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/invitations/my-doctors", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyDoctors(data);
        if (data.length > 0) {
          setForm(prev => ({ ...prev, doctor_id: data[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAppointment = async () => {
    if (!form.doctor_id || !form.date || !form.time || !form.reason.trim()) {
      alert("Por favor completa la fecha, hora, médico y motivo de consulta.");
      return;
    }

    try {
      setIsSubmitting(true);
      const dateTimeStr = `${form.date}T${form.time}:00`;
      await api.createAppointment({
        doctor_id: parseInt(form.doctor_id),
        date_time: dateTimeStr,
        type: form.type,
        reason: form.reason
      });
      setShowModal(false);
      setForm({ doctor_id: "", date: "", time: "", type: "Teleconsulta", reason: "" });
      loadAppointments();
    } catch (err: any) {
      alert("Error agendando cita: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-4 anim-fade-in relative">
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>Mis Citas Médicas</h1>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity font-bold shadow-sm"
          style={{ background: "#00A69D" }}
        >
          <Plus size={16} /> Solicitar Cita
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando mis citas...</div>
      ) : appointmentsList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-white rounded-2xl shadow-sm border border-gray-100">
          No tienes citas agendadas aún. Haz clic en "Solicitar Cita" para programar una.
        </div>
      ) : (
        <div className="space-y-3">
          {appointmentsList.map((apt, i) => (
            <div
              key={apt.id}
              className="bg-white rounded-xl p-5 flex items-center gap-4 anim-fade-in-up border border-gray-50 shadow-sm flex-wrap sm:flex-nowrap"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold text-sm overflow-hidden" 
                style={{ background: "#203A70" }}
              >
                {apt.doctor_avatar && (apt.doctor_avatar.startsWith("http") || apt.doctor_avatar.startsWith("data:")) ? (
                  <img src={apt.doctor_avatar} alt={apt.doctor_name || "Doctor"} className="w-full h-full object-cover" />
                ) : (
                  getInitialsSafe(apt.doctor_name)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: "#203A70", fontWeight: 700 }}>{apt.doctor_name || "Doctor"}</p>
                <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                  {apt.type || "Teleconsulta"} · {formatDateSafe(apt.date_time)}
                </p>
                {apt.reason && (
                  <p className="text-xs mt-1 text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <strong>Motivo:</strong> {apt.reason}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {apt.status === "en_curso" ? (
                  <>
                    <LiveElapsedBadge roomCode={apt.id} />
                    <button
                      onClick={() => onJoinCall?.(apt)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-opacity hover:opacity-90 shadow-xs"
                      style={{ background: "#00A69D" }}
                    >
                      <Video size={14} /> Unirse a Consulta
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                      style={{
                        background: apt.status === "confirmada" ? "#DCFCE7" : apt.status === "completada" ? "#F3F4F6" : apt.status === "pendiente" ? "#FEF3C7" : "#FEE2E2",
                        color: apt.status === "confirmada" ? "#10B981" : apt.status === "completada" ? "#6B7280" : apt.status === "pendiente" ? "#D97706" : "#EF4444",
                      }}
                    >
                      {apt.status === "confirmada" ? "✓ Confirmada" : apt.status === "completada" ? "✓ Finalizada" : apt.status === "pendiente" ? "⏳ Pendiente" : "✗ Rechazada"}
                    </span>

                    {apt.status === "confirmada" && (
                      <button
                        onClick={() => alert("El médico debe presionar 'Iniciar Videollamada' en su panel para iniciar la consulta. Tan pronto la inicie, se activará el botón 'Unirse' para ti.")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-gray-500 text-xs font-semibold bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
                        title="Esperando a que el doctor inicie la videollamada"
                      >
                        <Clock size={13} /> Esperando Médico
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Solicitar Cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm anim-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>Solicitar Cita Médica</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Médico asignado</label>
                {myDoctors.length === 0 ? (
                  <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No tienes médicos vinculados en tu lista. Primero debes aceptar una invitación de tu doctor.
                  </div>
                ) : (
                  <select
                    value={form.doctor_id}
                    onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:border-[#00A69D]"
                  >
                    {myDoctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.full_name} ({doc.specialty})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hora</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de consulta</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D]"
                >
                  <option value="Teleconsulta">Teleconsulta (Videollamada)</option>
                  <option value="Presencial">Presencial en Consultorio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo de la consulta</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Describe tus síntomas o el motivo de la cita (ej. dolor de cabeza continuo)..."
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D] h-20 resize-none"
                />
              </div>

              <button
                onClick={handleCreateAppointment}
                disabled={isSubmitting || myDoctors.length === 0}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md"
                style={{ background: "#00A69D" }}
              >
                {isSubmitting ? "Enviando solicitud..." : "Enviar Solicitud de Cita"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  return (
    <div className="markdown-body space-y-4">
      <ReactMarkdown>{displayed}</ReactMarkdown>
    </div>
  );
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

  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX - 220));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

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
    if (isSendingRef.current || typing) return;
    
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
      
      const updatedTitle = res.session_title || (query.slice(0, 25) + (query.length > 25 ? "..." : ""));
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: updatedTitle } : s));
    } catch (err: any) {
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: "Lo siento, hubo un error de conexión con mi cerebro clínico.", isNew: true }]);
    } finally {
      isSendingRef.current = false;
      setTyping(false);
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
        className="border-r flex flex-col bg-white overflow-hidden relative select-none" 
        style={{ 
          width: isSidebarOpen ? `${sidebarWidth}px` : "0px", 
          opacity: isSidebarOpen ? 1 : 0,
          borderColor: "#F3F4F6",
          flexShrink: 0,
          transition: isResizing ? "none" : "width 0.3s ease, opacity 0.3s ease"
        }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6", minWidth: `${sidebarWidth}px` }}>
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
        <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ minWidth: `${sidebarWidth}px` }}>
          <p className="text-xs font-bold px-2 py-2" style={{ color: "#9CA3AF" }}>Tus consultas</p>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              title={s.title}
              className="group w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left rounded-lg transition-colors cursor-pointer"
              style={{
                background: activeSessionId === s.id ? "#F3F4F6" : "transparent",
                color: activeSessionId === s.id ? "#203A70" : "#6B7280",
                fontWeight: activeSessionId === s.id ? 700 : 500,
              }}
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <MessageSquare size={15} style={{ opacity: 0.7, flexShrink: 0 }} />
                <span className="text-sm truncate" title={s.title}>{s.title}</span>
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

      {/* Resize Handle */}
      {isSidebarOpen && (
        <div
          onMouseDown={startResizing}
          className="w-1.5 h-full cursor-col-resize hover:bg-[#00A69D] active:bg-[#00A69D] transition-colors z-30 flex-shrink-0"
          style={{ background: isResizing ? "#00A69D" : "transparent" }}
          title="Arrastra para cambiar el ancho del menú lateral"
        />
      )}

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
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 w-full z-10 relative modern-scroll pb-56">
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
                  <div className={`text-[15px] ${m.from === 'bot' ? 'w-full max-w-3xl text-gray-800 pt-1.5' : 'max-w-xl px-6 py-4 bg-[#203A70] text-white rounded-3xl rounded-tr-sm shadow-md'}`} style={{ lineHeight: 1.7 }}>
                    {m.from === "bot" ? <TypewriterMessage text={m.text} animate={!!m.isNew} /> : m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden" style={{ background: "transparent", color: "white" }}>
                    <img src={logoIconImg} alt="Bot" className="w-full h-full object-contain" />
                  </div>
                  <div className="pt-3 px-2 flex items-center gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="w-2.5 h-2.5 rounded-full animate-bounce inline-block" style={{ background: "#D1D5DB", animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={(el) => { msgsEndRef.current = el; }} />
            </div>
          </div>
        )}

        {/* Gradient fade para que los mensajes no se corten bruscamente detrás del input */}
        {!isEmpty && (
          <div className="absolute bottom-0 left-0 w-full h-48 z-10 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(252,252,253,0) 0%, #FCFCFD 60%, #FCFCFD 100%)" }}></div>
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
                      if (!typing) send();
                    }
                  }}
                  placeholder={isEmpty ? "Escribe tu consulta o síntoma..." : "Escribe un mensaje..."}
                  className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 resize-none modern-scroll disabled:opacity-60"
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
                    disabled={!input.trim() || typing}
                    className="p-3 rounded-full text-white shadow-md transition-all disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                    style={{ background: (!input.trim() || typing) ? "#9CA3AF" : "#203A70" }}
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
                    onClick={() => !typing && send(s.text)}
                    disabled={typing}
                    className="bg-white/90 backdrop-blur-md rounded-full px-3 py-2.5 shadow-sm border border-gray-100/50 hover:bg-white hover:shadow-md transition-all flex items-center justify-center gap-2 group w-full disabled:opacity-50 disabled:cursor-not-allowed"
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
