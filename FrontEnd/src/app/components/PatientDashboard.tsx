import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api, UploadedDocument } from "../utils/api";
import {
  Video, Mic, MicOff, VideoOff, Phone, MapPin, Pill,
  Hand, Captions, Volume2, Sparkles, MessageSquare, Plus, Trash2, PanelLeft, Send, User, Clock, Loader2, FileText, X, Square, ChevronDown, Calendar, Sun, Sunset
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { FarmaciasMapaView } from "./FarmaciasMapaView";
import { PatientHome } from "./PatientHome";
import { SettingsView } from "./SettingsView";
import { TelemedicinaRoom } from "./TelemedicinaRoom";
import { GlobalFloatingCallWidget } from "./GlobalFloatingCallWidget";

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
  const [activeCallDoc, setActiveCallDoc] = useState<{ name: string; avatar?: string; id?: number; specialty?: string } | null>(null);
  const [inCall, setInCall] = useState(false);

  if (currentView !== lastView) { setLastView(currentView); setPharmacyMedicine(null); }

  const navigate = (v: string) => { onNavigate?.(v); };

  useEffect(() => {
    const savedActive = localStorage.getItem("patient_active_teleconsult");
    if (savedActive) {
      try {
        const parsed = JSON.parse(savedActive);
        if (parsed) {
          setActiveCallDoc(parsed);
          setInCall(true);
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const userExited = localStorage.getItem("patient_user_left_call") === "true";
    if (userExited) return;

    const checkActiveCall = () => {
      api.getAppointments().then((apts) => {
        if (Array.isArray(apts) && apts.length > 0) {
          const active = apts.find((a: any) => a.status === "en_curso");
          if (active) {
            const docData = {
              id: active.id,
              name: active.doctor_name || "Dr. Jose Matos",
              avatar: active.doctor_avatar,
              specialty: active.doctor_specialty || "Cardiología Clínica"
            };
            setActiveCallDoc(docData);
            const hasJoinedRoom = sessionStorage.getItem(`has_joined_teleconsult_${active.id}`) === "true";
            if (hasJoinedRoom) {
              setInCall(true);
              localStorage.setItem("patient_active_teleconsult", JSON.stringify(docData));
            }
          }
        }
      }).catch(() => {});
    };

    checkActiveCall();
    const interval = setInterval(checkActiveCall, 3000);
    return () => clearInterval(interval);
  }, [currentView]);

  const handleJoinCall = (apt: any) => {
    localStorage.removeItem("patient_user_left_call");
    const docData = {
      name: apt.doctor_name || apt.name || "Dr. Jose Matos",
      avatar: apt.doctor_avatar || apt.avatar,
      id: apt.id || 1,
      specialty: apt.doctor_specialty || apt.specialty || "Cardiología Clínica"
    };
    setActiveCallDoc(docData);
    setInCall(true);
    localStorage.setItem("patient_active_teleconsult", JSON.stringify(docData));
    navigate("teleconsult");
  };

  const handleEndCall = () => {
    localStorage.setItem("patient_user_left_call", "true");
    localStorage.removeItem("patient_active_teleconsult");
    setInCall(false);
    setActiveCallDoc(null);
    navigate("appointments");
  };

  const renderViewContent = () => {
    if (pharmacyMedicine) return <FarmaciasMapaView medicine={pharmacyMedicine} onBack={() => setPharmacyMedicine(null)} />;
    if (currentView === "home" || currentView === "dashboard") return <PatientHome userName={userName} onNavigate={navigate} onJoinCall={handleJoinCall} inCall={inCall} />;
    if (currentView === "prescriptions" || currentView === "pharmacy") return <RecetasYFarmacia onFindPharmacy={(med) => setPharmacyMedicine(med)} />;
    if (currentView === "appointments") return <CitasView key="appointments" onJoinCall={handleJoinCall} inCall={inCall} />;
    if (currentView === "appointments_new") return <CitasView key="appointments_new" onJoinCall={handleJoinCall} inCall={inCall} initialOpenModal={true} />;
    if (currentView === "ai-assistant") return <AsistenteView userName={userName} userAvatar={userAvatar} />;
    if (currentView === "settings") return <SettingsView role="patient" userName={userName} />;
    return <PatientHome userName={userName} onNavigate={navigate} onJoinCall={handleJoinCall} inCall={inCall} />;
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full relative">
      <div style={{ display: currentView === "teleconsult" ? "none" : "flex", flex: 1, flexDirection: "column", height: "100%" }}>
        {renderViewContent()}
      </div>
      {inCall && (
        <div className={currentView === "teleconsult" ? "flex flex-col flex-1 h-full w-full z-10" : "pointer-events-none fixed inset-0 z-50"}>
          <TelemedicinaSala
            userName={userName}
            userAvatar={userAvatar}
            activeCallDoc={activeCallDoc}
            onEndCall={handleEndCall}
            isMinimized={currentView !== "teleconsult"}
            onReturnToCall={() => navigate("teleconsult")}
          />
        </div>
      )}
    </div>
  );
}

/* ─── SALA DE TELEMEDICINA — unificada y dinámica ─── */
function TelemedicinaSala({ userName, userAvatar, activeCallDoc, onEndCall, isMinimized, onReturnToCall }: { userName: string; userAvatar?: string; activeCallDoc?: { name: string; avatar?: string; id?: number; specialty?: string } | null; onEndCall?: () => void; isMinimized?: boolean; onReturnToCall?: () => void; }) {
  const [resolvedDoc, setResolvedDoc] = useState<any>(activeCallDoc);

  useEffect(() => {
    if (!resolvedDoc || !resolvedDoc.id) {
      api.getAppointments().then((apts) => {
        if (Array.isArray(apts) && apts.length > 0) {
          const active = apts.find((a: any) => a.status === "en_curso" || a.status === "confirmada" || a.status === "pendiente") || apts[0];
          if (active) {
            setResolvedDoc({
              id: active.id,
              name: active.doctor_name || "Dr. Jose Matos",
              avatar: active.doctor_avatar,
              specialty: active.doctor_specialty
            });
          }
        }
      }).catch(() => {});
    }
  }, [activeCallDoc]);

  return (
    <TelemedicinaRoom
      role="patient"
      userName={userName || "Paciente"}
      userAvatar={userAvatar}
      counterpartName={resolvedDoc?.name || activeCallDoc?.name || "Dr. Jose Matos"}
      counterpartAvatar={resolvedDoc?.avatar || activeCallDoc?.avatar}
      counterpartSpecialty={resolvedDoc?.specialty || activeCallDoc?.specialty}
      appointmentId={resolvedDoc?.id || activeCallDoc?.id}
      onEndCall={() => {
        if (onEndCall) onEndCall();
        else window.history.back();
      }}
      isMinimized={isMinimized}
      onReturnToCall={onReturnToCall}
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
            dose: rx.dose,
            frequency: rx.frequency,
            status: rx.status,
            issued_at: rx.issued_at,
            expires_at: rx.expires_at
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

  const formatDateSafe = (dateString?: string) => {
    if (!dateString) return "No disponible";
    try {
      return new Date(dateString).toLocaleString("es-DO", {
        day: "numeric", month: "numeric", year: "2-digit",
        hour: "numeric", minute: "2-digit", hour12: true
      });
    } catch {
      return "Inválida";
    }
  };

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
            className="bg-white rounded-xl p-5 anim-fade-in-up flex flex-col justify-between"
            style={{
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              opacity: rx.status === "vencida" ? 0.65 : 1,
              animationDelay: `${120 + rxIdx * 60}ms`,
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#F0FFFE" }}>
                  <Pill size={22} style={{ color: rx.status === "activa" ? "#00A69D" : "#9CA3AF" }} />
                </div>
                <span
                  className={`text-sm px-4 py-1.5 rounded-lg font-bold border ${
                    rx.status === "activa"
                      ? "bg-green-50 text-green-600 border-green-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {rx.status === "activa" ? "Activa" : "Vencida"}
                </span>
              </div>
              <p style={{ color: "#203A70", fontWeight: 700 }}>{rx.medicine}</p>
              <p className="text-sm mt-1 mb-3" style={{ color: "#9CA3AF" }}>{rx.doctor}</p>
              
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold text-gray-400 block mb-0.5">Dosis:</span>
                  <span className="text-sm text-[#00A69D] font-medium leading-snug block">{rx.dose}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block mb-0.5">Frecuencia:</span>
                  <span className="text-sm text-[#00A69D] font-medium leading-snug block">{rx.frequency}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
                <div>
                  <div className="text-gray-400 font-medium mb-0.5">Emitida el</div>
                  <div className="font-semibold text-gray-700">{formatDateSafe(rx.issued_at)}</div>
                </div>
                <div>
                  <div className="text-gray-400 font-medium mb-0.5">Válida hasta</div>
                  <div className="font-semibold text-gray-700">{formatDateSafe(rx.expires_at)}</div>
                </div>
              </div>
            </div>
            
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
        const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || "https://superucedoc-api.duckdns.org";
        const res = await fetch(`${apiBase}/api/realtime/presence/${roomCode}`);
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
      className="px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 border border-cyan-200"
      style={{ background: "#E0F2FE", color: "#0284C7" }}
    >
      <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
      En Curso · {m}:{s}
    </span>
  );
}

/* ─── CALENDARIO PERSONALIZADO ─── */
function MonthCalendar({ selectedDate, onSelectDate, availableDaysStr, minDate }: { selectedDate: string; onSelectDate: (d: string) => void; availableDaysStr: string; minDate?: string }) {
  const [currentDate, setCurrentDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayMap: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' };
  const availableDaysArr = availableDaysStr ? availableDaysStr.split(",") : ["L","M","X","J","V"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  // Week starts on Sunday as per the screenshot (DOM LUN MAR MIE JUE VIE SAB)
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  // Pad the rest to always have exactly 42 cells (6 rows) to keep height stable
  while (days.length < 42) {
    days.push(null);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let minDateObj = minDate ? new Date(minDate + "T00:00:00") : today;
  let maxDateObj = new Date(today);
  maxDateObj.setDate(maxDateObj.getDate() + 30); // Permitir agendar hasta 30 días en el futuro

  return (
    <div className="bg-transparent rounded-2xl pt-3" style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}>
      <div className="flex justify-between items-center mb-4 px-2">
        <button type="button" onClick={prevMonth} className="text-gray-400 font-bold hover:text-[#203A70]">&lt;</button>
        <span className="font-bold text-[17px]" style={{ color: "#203A70" }}>
          {monthNames[currentDate.getMonth()]} De {currentDate.getFullYear()}
        </span>
        <button type="button" onClick={nextMonth} className="text-gray-400 font-bold hover:text-[#203A70]">&gt;</button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"].map(day => (
          <div key={day} className="text-[10px] font-bold text-gray-400">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((day, idx) => {
          if (!day) return <div key={idx} className="w-9 h-9"></div>;
          
          const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const dateStr = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD local
          
          const isSelected = selectedDate === dateStr;
          const dayLetter = dayMap[dateObj.getDay()];
          const isAvailable = availableDaysArr.includes(dayLetter) && dateObj.getTime() >= minDateObj.getTime() && dateObj.getTime() <= maxDateObj.getTime();

          return (
            <button
              key={idx}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelectDate(dateStr)}
              className="w-9 h-9 mx-auto flex items-center justify-center text-sm font-bold rounded-xl transition-all"
              style={{
                background: isSelected ? "#203A70" : "transparent",
                color: isSelected ? "white" : isAvailable ? "#4B5563" : "#D1D5DB",
                cursor: isAvailable ? "pointer" : "not-allowed"
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CITAS ─── */
function CitasView({ onJoinCall, inCall, initialOpenModal }: { onJoinCall?: (apt: any) => void; inCall?: boolean; initialOpenModal?: boolean }) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(initialOpenModal || false);
  const [myDoctors, setMyDoctors] = useState<any[]>([]);
  const [form, setForm] = useState({ doctor_id: "", date: "", time: "", type: "Teleconsulta", reason: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [doctorSearchName, setDoctorSearchName] = useState("");
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (myDoctors.length > 0 && form.doctor_id) {
      const doc = myDoctors.find(d => d.id.toString() === form.doctor_id);
      if (doc) setDoctorSearchName(`${doc.full_name} (${doc.specialty})`);
      
      // Obtener las horas bloqueadas para este doctor
      api.getDoctorBookedSlots(form.doctor_id).then(slots => {
        setBookedSlots(slots);
      }).catch(err => console.error("Error fetching booked slots", err));
    } else {
      setBookedSlots([]);
    }
  }, [myDoctors, form.doctor_id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target as Node)) {
        setShowDoctorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredDoctors = myDoctors.filter(d => 
    d.full_name.toLowerCase().includes(doctorSearchName.toLowerCase()) || 
    d.specialty.toLowerCase().includes(doctorSearchName.toLowerCase())
  );

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      if (Array.isArray(data)) {
        data.sort((a: any, b: any) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
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
          data.sort((a: any, b: any) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
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
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || "https://superucedoc-api.duckdns.org";
      const res = await fetch(`${apiBase}/api/invitations/my-doctors`, {
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

  useEffect(() => {
    if (initialOpenModal && myDoctors.length === 0) {
      handleOpenModal();
    }
  }, [initialOpenModal]);

  const handleCreateAppointment = async () => {
    if (!form.doctor_id || !form.date || !form.time || !form.reason.trim()) {
      alert("Por favor completa la fecha, hora, médico y motivo de consulta.");
      return;
    }

    const selectedDateTime = new Date(`${form.date}T${form.time}:00`);
    if (selectedDateTime < new Date()) {
      alert("No puedes agendar una cita para una fecha/hora que ya ha pasado.");
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
          style={{ background: "#00A69D", boxShadow: "0 3px 12px rgba(0,166,157,0.3)" }}
        >
          <Plus size={16} /> Agendar Cita
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando mis citas...</div>
      ) : appointmentsList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-white rounded-2xl shadow-sm border border-gray-100">
          No tienes citas agendadas aún. Haz clic en "Agendar Cita" para programar una.
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p style={{ color: "#203A70", fontWeight: 700 }}>{apt.doctor_name || "Doctor"}</p>
                  {(apt.doctor_specialty || apt.specialty) && (
                    <span className="px-4 py-1.5 rounded-lg text-sm font-bold border bg-teal-50 text-teal-600 border-teal-200">
                      {apt.doctor_specialty || apt.specialty}
                    </span>
                  )}
                </div>
                <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                  {apt.type || "Teleconsulta"} · Agendada para {formatDateSafe(apt.date_time)}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(apt.real_start_time || apt.real_end_time) && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                      {!apt.real_end_time && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                      )}
                      <span>
                        {apt.real_start_time && apt.real_end_time 
                          ? `Atendida de ${new Date(new Date(apt.real_start_time).getTime() - 4 * 60 * 60 * 1000).toLocaleTimeString('es-DO', {hour: 'numeric', minute:'2-digit', hour12: true})} a ${new Date(new Date(apt.real_end_time).getTime() - 4 * 60 * 60 * 1000).toLocaleTimeString('es-DO', {hour: 'numeric', minute:'2-digit', hour12: true})}`
                          : apt.real_start_time 
                          ? `Iniciada a las ${new Date(new Date(apt.real_start_time).getTime() - 4 * 60 * 60 * 1000).toLocaleTimeString('es-DO', {hour: 'numeric', minute:'2-digit', hour12: true})} (En curso)`
                          : `Finalizada a las ${new Date(new Date(apt.real_end_time).getTime() - 4 * 60 * 60 * 1000).toLocaleTimeString('es-DO', {hour: 'numeric', minute:'2-digit', hour12: true})}`
                        }
                      </span>
                    </div>
                  )}
                  {apt.reason && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      {(apt.real_start_time || apt.real_end_time) && <span className="opacity-50">•</span>}
                      <span>{apt.reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {apt.status === "en_curso" ? (
                  <button
                    onClick={() => onJoinCall?.(apt)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
                    style={{ background: "#00A69D", boxShadow: "0 3px 12px rgba(0,166,157,0.3)" }}
                  >
                    <Video size={15} /> {inCall ? "Volver a la Consulta" : "Unirse a Consulta"}
                  </button>
                ) : (
                  <>
                    <span
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold border ${
                        apt.status === "confirmada" ? "bg-teal-50 text-teal-600 border-teal-200" : 
                        apt.status === "completada" ? "bg-gray-50 text-gray-500 border-gray-200" : 
                        apt.status === "pendiente" ? "bg-amber-50 text-amber-600 border-amber-200" : 
                        "bg-red-50 text-red-600 border-red-200"
                      }`}
                    >
                      {apt.status === "confirmada" ? "Confirmada" : apt.status === "completada" ? "Finalizada" : apt.status === "pendiente" ? "Pendiente" : "Rechazada"}
                    </span>


                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agendar Cita */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm anim-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>Agendar Cita Médica</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Médico asignado</label>
                {myDoctors.length === 0 ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No tienes médicos vinculados en tu lista. Primero debes aceptar una invitación de tu doctor.
                  </div>
                ) : (
                  <div className="relative" ref={doctorDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                      className="w-full px-4 py-3 border rounded-xl flex items-center justify-between outline-none focus:border-[#00A69D] text-left transition-colors bg-white shadow-sm hover:bg-gray-50"
                      style={{ borderColor: "#E5E7EB" }}
                    >
                      {form.doctor_id ? (
                        (() => {
                          const doc = myDoctors.find(d => d.id.toString() === form.doctor_id);
                          if (!doc) return <span className="text-gray-400">Seleccionar médico...</span>;
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                                {doc.avatar && (doc.avatar.startsWith("http") || doc.avatar.startsWith("data:")) ? (
                                  <img src={doc.avatar} alt={doc.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  getInitialsSafe(doc.full_name)
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-semibold" style={{ color: "#203A70", lineHeight: 1.2 }}>{doc.full_name}</div>
                                <div className="text-sm text-gray-500 mt-0.5">{doc.specialty}</div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-gray-400">Seleccionar médico...</span>
                      )}
                      <ChevronDown size={18} className="text-gray-400" />
                    </button>
                    
                    {showDoctorDropdown && myDoctors.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto anim-fade-in-up">
                        {myDoctors.map(doc => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              setDoctorSearchName(`${doc.full_name} (${doc.specialty})`);
                              setForm({ ...form, doctor_id: doc.id.toString() });
                              setShowDoctorDropdown(false);
                            }}
                            className="flex items-center gap-3 p-3 hover:bg-[#F0FFFE] cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold text-sm overflow-hidden shadow-sm" style={{ background: "#203A70" }}>
                              {doc.avatar && (doc.avatar.startsWith("http") || doc.avatar.startsWith("data:")) ? (
                                <img src={doc.avatar} alt={doc.full_name} className="w-full h-full object-cover" />
                              ) : (
                                getInitialsSafe(doc.full_name)
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold" style={{ color: "#203A70" }}>{doc.full_name}</div>
                              <div className="text-sm text-gray-500">{doc.specialty}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Date & Time Picker */}
              <div className="space-y-4">
                {form.doctor_id ? (
                  (() => {
                    const doc = myDoctors.find(d => d.id.toString() === form.doctor_id);
                    if (!doc) return null;
                    
                    const availableDaysStr = doc.available_days || "L,M,X,J,V";
                    const startTimeStr = doc.start_time || "08:00";
                    const endTimeStr = doc.end_time || "17:00";
                    
                    const dayMap: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' };
                    const availableDaysArr = availableDaysStr.split(",");
                    
                    // Generate time slots for selected date
                    const timeSlots = [];
                    if (form.date) {
                      const [sH, sM] = startTimeStr.split(":").map(Number);
                      const [eH, eM] = endTimeStr.split(":").map(Number);
                      let currentMinutes = sH * 60 + sM;
                      const endMinutes = eH * 60 + eM;
                      
                      const selectedDateObj = new Date(form.date);
                      const now = new Date();
                      // Force time to 0 to compare dates accurately
                      const isToday = selectedDateObj.toISOString().split("T")[0] === now.toISOString().split("T")[0];
                      const nowMinutes = now.getHours() * 60 + now.getMinutes();

                      while (currentMinutes < endMinutes) {
                        // If it's today, only show future time slots (at least 30 mins from now)
                        if (!isToday || currentMinutes > nowMinutes + 15) {
                          const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
                          const m = (currentMinutes % 60).toString().padStart(2, '0');
                          
                          // Check if slot is booked
                          const slotPrefixT = `${form.date}T${h}:${m}`;
                          const slotPrefixSpace = `${form.date} ${h}:${m}`;
                          const isBooked = bookedSlots.some(slot => slot.startsWith(slotPrefixT) || slot.startsWith(slotPrefixSpace));
                          
                          if (!isBooked) {
                            timeSlots.push(`${h}:${m}`);
                          }
                        }
                        currentMinutes += 30; // 30 min intervals
                      }
                    }

                    return (
                      <div className="space-y-4">
                        {!form.date ? (
                          <div className="anim-fade-in-up">
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Paso 1: Selecciona un día</label>
                            <div className="border rounded-2xl p-1 bg-white shadow-sm" style={{ borderColor: "#E5E7EB" }}>
                              <MonthCalendar
                                selectedDate={form.date}
                                onSelectDate={(d) => setForm({ ...form, date: d, time: "" })}
                                availableDaysStr={availableDaysStr}
                                minDate={new Date().toLocaleDateString('en-CA')}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="anim-fade-in space-y-4">
                            <div 
                              onClick={() => setForm({ ...form, date: "", time: "" })}
                              className="flex justify-between items-center p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
                                  <Calendar size={16} />
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Día seleccionado</div>
                                  <div className="font-bold text-sm text-[#203A70] capitalize">
                                    {new Date(form.date + "T00:00:00").toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                  </div>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-[#00A69D]">Cambiar</span>
                            </div>

                            {!form.time ? (
                              <div className="anim-fade-in-up">
                                <label className="block text-sm font-semibold text-gray-600 mb-2">Paso 2: Selecciona la hora</label>
                                {timeSlots.length === 0 ? (
                                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                                    No hay horarios disponibles para este día.
                                  </div>
                                ) : (
                                  <div className="bg-white p-4 rounded-2xl border shadow-sm max-h-64 overflow-y-auto" style={{ borderColor: "#E5E7EB" }}>
                                    {(() => {
                                      const format12Hour = (time24: string) => {
                                        const [h, m] = time24.split(":").map(Number);
                                        const ampm = h >= 12 ? 'PM' : 'AM';
                                        const h12 = h % 12 || 12;
                                        return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
                                      };
                                      
                                      const morningSlots = timeSlots.filter(t => parseInt(t.split(":")[0]) < 12);
                                      const afternoonSlots = timeSlots.filter(t => parseInt(t.split(":")[0]) >= 12);

                                      return (
                                        <>
                                          {morningSlots.length > 0 && (
                                            <div className="mb-5">
                                              <div className="flex items-center gap-2 mb-3 text-[#203A70]">
                                                <Sun size={16} />
                                                <span className="font-bold text-sm">Mañana</span>
                                              </div>
                                              <div className="grid grid-cols-3 gap-2">
                                                {morningSlots.map(time => (
                                                  <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, time })}
                                                    className="py-2.5 text-sm rounded-xl font-bold transition-all border hover:border-[#00A69D]"
                                                    style={{
                                                      background: form.time === time ? "#203A70" : "white",
                                                      color: form.time === time ? "white" : "#4B5563",
                                                      borderColor: form.time === time ? "#203A70" : "#E5E7EB"
                                                    }}
                                                  >
                                                    {format12Hour(time)}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {afternoonSlots.length > 0 && (
                                            <div>
                                              <div className="flex items-center gap-2 mb-3 text-[#203A70]">
                                                <Sunset size={16} />
                                                <span className="font-bold text-sm">Tarde</span>
                                              </div>
                                              <div className="grid grid-cols-3 gap-2">
                                                {afternoonSlots.map(time => (
                                                  <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, time })}
                                                    className="py-2.5 text-sm rounded-xl font-bold transition-all border hover:border-[#00A69D]"
                                                    style={{
                                                      background: form.time === time ? "#203A70" : "white",
                                                      color: form.time === time ? "white" : "#4B5563",
                                                      borderColor: form.time === time ? "#203A70" : "#E5E7EB"
                                                    }}
                                                  >
                                                    {format12Hour(time)}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="anim-fade-in-up">
                                <div 
                                  onClick={() => setForm({ ...form, time: "" })}
                                  className="flex justify-between items-center p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors mb-4"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
                                      <Clock size={16} />
                                    </div>
                                    <div>
                                      <div className="text-sm text-gray-500">Hora seleccionada</div>
                                      <div className="font-bold text-sm text-[#203A70]">
                                        {(() => {
                                          const [h, m] = form.time.split(":").map(Number);
                                          const ampm = h >= 12 ? 'PM' : 'AM';
                                          const h12 = h % 12 || 12;
                                          return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-sm font-bold text-[#00A69D]">Cambiar</span>
                                </div>

                                <div className="space-y-4 bg-white p-4 rounded-2xl border shadow-sm" style={{ borderColor: "#E5E7EB" }}>
                                  <label className="block text-sm font-semibold text-[#203A70] mb-2 border-b pb-2">Paso 3: Detalles de consulta</label>
                                  
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Tipo de consulta</label>
                                    <select
                                      value={form.type}
                                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                                      className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D] bg-gray-50 text-sm"
                                    >
                                      <option value="Teleconsulta">Teleconsulta (Videollamada)</option>
                                      <option value="Presencial">Presencial en Consultorio</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Motivo de la consulta</label>
                                    <textarea
                                      value={form.reason}
                                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                      placeholder="Describe tus síntomas (ej. dolor de cabeza continuo)..."
                                      className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D] h-20 resize-none bg-gray-50 text-sm"
                                    />
                                  </div>

                                  <button
                                    onClick={handleCreateAppointment}
                                    disabled={isSubmitting || !form.reason.trim()}
                                    className="w-full mt-2 py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                                    style={{ background: "#00A69D" }}
                                  >
                                    {isSubmitting ? "Enviando..." : "Confirmar Cita"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-gray-400 italic">Selecciona un médico para ver su disponibilidad.</div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
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
    if (saved && saved !== "new") return parseInt(saved);
    return null;
  });
  const [sessionActiveDocIds, setSessionActiveDocIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = sessionStorage.getItem("aiSidebarOpen");
    return saved !== null ? saved === "true" : true;
  });
  const skipFetchRef = useRef(false);
  const isSendingRef = useRef(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ from: string; text: string; isNew?: boolean }[]>([]);
  const [typing, setTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoSendAfterRecordRef = useRef(false);
  const msgsEndRef = useRef<HTMLDivElement | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [audioData, setAudioData] = useState<number[]>(new Array(40).fill(5));
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    
    // Al cambiar de sesión, limpiamos los documentos activos del contexto anterior
    setSessionActiveDocIds([]);
    
    if (activeSessionId) {
      setTyping(true);
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
        setTyping(false);
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

  const handlePlusClick = () => {
    if (fileInputRef.current && !isUploadingDoc && !typing) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsUploadingDoc(true);
      const res = await api.uploadDocument(file);
      setAttachedFiles((prev) => [...prev.filter(d => d.doc_id !== res.doc_id), res]);
    } catch (err: any) {
      alert(err.message || "No se pudo procesar el documento clínico.");
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (docId: string) => {
    setAttachedFiles((prev) => prev.filter((d) => d.doc_id !== docId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isRecording && !isUploadingDoc && !typing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isRecording || isUploadingDoc || typing) return;
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    // Toma el primer archivo (limitado a 1 para mantener paridad con el clic)
    const file = files[0];
    try {
      setIsUploadingDoc(true);
      const res = await api.uploadDocument(file);
      setAttachedFiles((prev) => [...prev.filter(d => d.doc_id !== res.doc_id), res]);
    } catch (err: any) {
      alert(err.message || "No se pudo procesar el documento clínico.");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const send = async (text?: string, bypassChecks = false) => {
    if (!bypassChecks && (isSendingRef.current || typing || isTranscribing || isUploadingDoc)) return;
    
    if (isRecording) {
      autoSendAfterRecordRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      return;
    }

    const query = (text ?? input).trim();
    if (!query && attachedFiles.length === 0) return;
    
    isSendingRef.current = true;
    setInput("");
    const docIds = attachedFiles.map(f => f.doc_id);
    const docNames = attachedFiles.map(f => f.filename).join(", ");
    setAttachedFiles([]);
    
    let currentSessionDocs = [...sessionActiveDocIds];
    if (docIds.length > 0) {
      currentSessionDocs = Array.from(new Set([...currentSessionDocs, ...docIds]));
      setSessionActiveDocIds(currentSessionDocs);
    }
    
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
       skipFetchRef.current = true;
       const newSession = await api.createChatSession();
       currentSessionId = newSession.id;
       setActiveSessionId(currentSessionId);
       setSessions(prev => [newSession, ...prev]);
    }

    let displayQuery = query;
    if (docIds.length > 0) {
      displayQuery = (displayQuery ? `${displayQuery}\n\n` : "") + `[📎 Documento clínico: ${docNames}]`;
    }

    setMsgs((p) => [...p, { from: "user", text: displayQuery, isNew: true }]);
    setTyping(true);

    try {
      const history = msgs.map(m => ({
        role: m.from === "bot" ? "assistant" : "user",
        content: m.text
      }));
      
      const res = await api.queryChatbot(query, currentSessionId, history, currentSessionDocs.length > 0 ? currentSessionDocs : undefined);
      
      if (res.session_title && !sessions.find(s => s.id === currentSessionId)?.title) {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: res.session_title } : s));
      }

      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: res.reply, isNew: true }]);
    } catch (err: any) {
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: "Lo siento, hubo un error de conexión con mi cerebro clínico.", isNew: true }]);
    } finally {
      isSendingRef.current = false;
      setTyping(false);
    }
  };

  const handleToggleRecord = async () => {
    if (isTranscribing || typing) return;

    if (isRecording) {
      autoSendAfterRecordRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioData(new Array(40).fill(5));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = [];
        for (let i = 0; i < 40; i++) {
          bars.push(dataArray[i] || 5);
        }
        setAudioData(bars);
        animationFrameRef.current = requestAnimationFrame(updateAudio);
      };
      updateAudio();
      audioContextRef.current = audioCtx;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        
        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            try {
              const res = await api.speechToText(base64Audio, mediaRecorder.mimeType || "webm", activeSessionId || undefined);
              if (res.transcription) {
                setInput((prevInput) => {
                  const combinedText = (prevInput ? `${prevInput} ${res.transcription}` : res.transcription).trim();
                  if (autoSendAfterRecordRef.current) {
                    autoSendAfterRecordRef.current = false;
                    setTimeout(() => send(combinedText, true), 0);
                    return "";
                  }
                  return combinedText;
                });
              }
            } catch (error) {
              console.error("Error transcribiendo audio con Gemini:", error);
              const errMsg = error instanceof Error ? error.message : "Hubo un problema transcribiendo tu nota de voz con Gemini 2.5 Flash. Por favor intenta de nuevo.";
              setMsgs(p => [...p, { from: "bot", text: errMsg, isNew: true }]);
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (err) {
          console.error("Error leyendo blob:", err);
          autoSendAfterRecordRef.current = false;
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("No se pudo acceder al micrófono:", err);
      alert("Por favor habilita el permiso de micrófono en tu navegador para usar esta función.");
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
          <p className="text-sm font-bold px-2 py-2" style={{ color: "#9CA3AF" }}>Tus consultas</p>
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
            <div 
              className={`animated-border-wrapper w-full transition-all duration-300 ease-in-out mb-4 ${isRecording ? "rounded-full shadow-2xl" : "rounded-3xl"} ${isDragging ? "shadow-[0_0_0_4px_rgba(0,166,157,0.3)] scale-[1.01]" : "shadow-2xl"}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`animated-border-inner w-full flex flex-col relative transition-all duration-300 ease-in-out ${isRecording ? "rounded-full p-2 bg-white" : "rounded-3xl p-4"} ${isDragging ? "bg-teal-50/50" : "bg-white"}`}>
                
                {/* Indicador visual al arrastrar */}
                {isDragging && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-teal-50/80 rounded-3xl backdrop-blur-sm pointer-events-none border-2 border-dashed border-[#00A69D]">
                    <div className="flex flex-col items-center text-[#00A69D]">
                      <Plus size={32} className="mb-2 animate-bounce" />
                      <span className="font-bold text-sm">Suelta tu documento aquí</span>
                    </div>
                  </div>
                )}

                {/* Tarjetas flotantes de documentos adjuntos */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${(!isRecording && (attachedFiles.length > 0 || isUploadingDoc)) ? "max-h-[200px] opacity-100 mb-2" : "max-h-0 opacity-0 mb-0"}`}>
                  <div className="flex flex-wrap items-center gap-2 px-2 pb-2 border-b border-gray-100">
                    {attachedFiles.map((doc) => (
                      <div key={doc.doc_id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200/80 rounded-lg text-[13px] text-gray-700 shadow-2xs transition-all hover:bg-gray-100/70">
                        <FileText size={15} className="text-[#203A70] shrink-0" />
                        <span className="font-medium max-w-[190px] truncate" title={doc.filename}>{doc.filename}</span>
                        <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200 uppercase font-semibold tracking-wider">Procesado</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(doc.doc_id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors ml-0.5 p-0.5 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {isUploadingDoc && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/80 border border-dashed border-gray-300 rounded-lg text-[13px] text-gray-600">
                        <Loader2 size={15} className="animate-spin text-[#203A70]" />
                        <span className="font-medium">Procesando...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Textarea Contenedor (Se oculta suavemente al grabar) */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden w-full ${isRecording ? "max-h-0 opacity-0 min-h-0" : "max-h-[200px] opacity-100"}`}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!typing && (input.trim() || attachedFiles.length > 0)) send();
                      }
                    }}
                    placeholder={isEmpty && attachedFiles.length === 0 ? "Escribe tu consulta o síntoma..." : "Escribe un mensaje..."}
                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 resize-none modern-scroll disabled:opacity-60"
                    style={{ fontSize: "16px", minHeight: "72px" }}
                    rows={1}
                    autoFocus
                  />
                </div>

                {/* Barra inferior (Botones y Audio Visualizer) */}
                <div className={`flex w-full items-center justify-between transition-all duration-300 ${isRecording ? "mt-0" : "mt-1"}`}>
                  
                  {/* Botones de acción izquierda */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <div className={`transition-all duration-300 overflow-hidden ${isRecording ? "w-0 opacity-0 scale-0" : "w-[40px] opacity-100 scale-100"}`}>
                      <button
                        onClick={handlePlusClick}
                        disabled={isUploadingDoc || typing || isTranscribing || isRecording}
                        className="p-2.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed w-[40px] h-[40px] flex items-center justify-center"
                      >
                        {isUploadingDoc ? <Loader2 size={20} className="animate-spin text-[#203A70]" /> : <Plus size={20} />}
                      </button>
                    </div>
                    <button
                      onClick={handleToggleRecord}
                      disabled={isTranscribing || typing || isUploadingDoc}
                      className={`p-2.5 rounded-full transition-all duration-300 flex items-center justify-center relative w-[44px] h-[44px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 ${
                        isRecording 
                          ? "text-[#203A70] bg-gray-50 hover:bg-gray-100 ml-1" 
                          : isTranscribing
                          ? "text-[#00A69D]"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {isTranscribing ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : isRecording ? (
                        <Square size={20} fill="currentColor" />
                      ) : (
                        <Mic size={20} />
                      )}
                    </button>
                  </div>

                  {/* Audio Visualizer (Aparece y empuja al grabar) */}
                  <div 
                    className={`flex items-center justify-center gap-[3px] overflow-hidden transition-all duration-300 ease-in-out ${
                      isRecording ? "flex-1 opacity-100 px-4 h-[44px] max-w-[500px]" : "w-0 opacity-0 px-0 h-[44px] max-w-0"
                    }`}
                  >
                    {audioData.map((val, i) => (
                      <div 
                        key={i} 
                        className="w-1.5 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${Math.max(4, (val / 255) * 36)}px`, 
                          backgroundColor: val > 150 ? "#00A69D" : "#203A70",
                          opacity: 0.6 + (val / 255) * 0.4 
                        }}
                      />
                    ))}
                  </div>

                  {/* Botón de Enviar derecha */}
                  <button
                    onClick={() => send()}
                    disabled={(!input.trim() && !isRecording && attachedFiles.length === 0) || typing || isUploadingDoc || (isTranscribing && !autoSendAfterRecordRef.current)}
                    className={`shrink-0 rounded-full text-white shadow-md transition-all duration-300 disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed flex items-center justify-center ${isRecording ? "mr-1" : ""}`}
                    style={{ 
                      background: ((!input.trim() && !isRecording && attachedFiles.length === 0) || typing || isUploadingDoc || (isTranscribing && !autoSendAfterRecordRef.current)) ? "#9CA3AF" : "#203A70", 
                      width: isRecording ? "44px" : "48px", 
                      height: isRecording ? "44px" : "48px"
                    }}
                  >
                    {(isTranscribing && autoSendAfterRecordRef.current) ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} style={{ transform: "translate(-1px, 1px)" }} />
                    )}
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
