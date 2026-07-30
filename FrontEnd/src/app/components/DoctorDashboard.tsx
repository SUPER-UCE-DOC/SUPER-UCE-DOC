import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import {
  Video, Mic, MicOff, VideoOff, Phone, Send, CheckCircle,
  Calendar, Users, Stethoscope, FileText, Clock, AlertCircle,
  ChevronRight, Plus, Search, Brain, Zap, X, Pill
} from "lucide-react";
import { DoctorHome } from "./DoctorHome";
import { SettingsView } from "./SettingsView";
import { TelemedicinaRoom } from "./TelemedicinaRoom";
import { GlobalFloatingCallWidget } from "./GlobalFloatingCallWidget";

type View = string;

interface DoctorDashboardProps {
  userName: string;
  userAvatar?: string;
  currentView: View;
  onNavigate?: (view: string) => void;
}

function formatDateSafe(dateStr?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "Fecha pendiente";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("es-DO", options || { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return String(dateStr);
  }
}

function getAvatarInitials(name?: string): string {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

const agendaItems = [
  { id: 1, patient: "María López", time: "09:00", type: "Teleconsulta", deaf: true, status: "completada" },
  { id: 2, patient: "Carlos Vega", time: "10:00", type: "Presencial", deaf: false, status: "completada" },
  { id: 3, patient: "Rosa Chávez", time: "11:30", type: "Teleconsulta", deaf: true, status: "en_curso" },
  { id: 4, patient: "Juan Paredes", time: "14:00", type: "Seguimiento", deaf: false, status: "pendiente" },
  { id: 5, patient: "Ana Morales", time: "15:30", type: "Teleconsulta", deaf: true, status: "pendiente" },
];

const patients = [
  { id: 1, name: "María López", age: 45, condition: "Hipertensión Grado 1", lastVisit: "08 Jul", status: "estable", deaf: true, avatar: "ML" },
  { id: 2, name: "Juan Paredes", age: 62, condition: "Diabetes Tipo 2", lastVisit: "10 Jul", status: "seguimiento", deaf: false, avatar: "JP" },
  { id: 3, name: "Rosa Chávez", age: 38, condition: "Ansiedad Generalizada", lastVisit: "05 Jul", status: "critico", deaf: true, avatar: "RC" },
  { id: 4, name: "Carlos Vega", age: 55, condition: "Insuficiencia Cardíaca", lastVisit: "12 Jul", status: "estable", deaf: false, avatar: "CV" },
  { id: 5, name: "Ana Morales", age: 29, condition: "Control prenatal semana 28", lastVisit: "11 Jul", status: "estable", deaf: true, avatar: "AM" },
];

const aiTranslations = [
  { time: "11:32", gesture: "DOLOR + CABEZA", translation: "La paciente indica dolor de cabeza" },
  { time: "11:33", gesture: "TRES + DÍAS", translation: "Señala que lleva 3 días con el síntoma" },
  { time: "11:33", gesture: "MEDICAMENTO + NO", translation: "No ha tomado medicación" },
  { time: "11:34", gesture: "MAREO + CAMA", translation: "Refiere mareos al levantarse de la cama" },
  { time: "11:35", gesture: "PRESIÓN + ALTA", translation: "Asocia síntomas con su hipertensión" },
];

export function DoctorDashboard({ userName, userAvatar, currentView, onNavigate }: DoctorDashboardProps) {
  const navigate = (v: string) => onNavigate?.(v);

  const [activeAppointment, setActiveAppointment] = useState<any>(null);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    const savedActive = localStorage.getItem("doctor_active_teleconsult");
    if (savedActive) {
      try {
        const parsed = JSON.parse(savedActive);
        if (parsed && parsed.id) {
          setActiveAppointment(parsed);
          setInCall(true);
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const userExited = localStorage.getItem("doctor_user_left_call") === "true";
    if (userExited) return;

    api.getAppointments().then((data) => {
      if (Array.isArray(data)) {
        const inProgress = data.find((a: any) => a.status === "en_curso");
        if (inProgress) {
          setActiveAppointment(inProgress);
          setInCall(true);
          localStorage.setItem("doctor_active_teleconsult", JSON.stringify(inProgress));
        }
      }
    }).catch(() => {});
  }, [currentView]);

  const handleEndCall = () => {
    localStorage.removeItem("doctor_active_teleconsult");
    localStorage.setItem("doctor_user_left_call", "true");
    setInCall(false);
    setActiveAppointment(null);
    navigate("home");
  };

  const renderViewContent = () => {
    if (currentView === "home") return <DoctorHome userName={userName} onNavigate={navigate} inCall={inCall} />;
    if (currentView === "dashboard" || currentView === "schedule") return <AgendaView userName={userName} />;
    if (currentView === "patients") return <PatientsView />;
    if (currentView === "teleconsult" || currentView === "ai-assistant") return <TeleconsultaView userName={userName} userAvatar={userAvatar} onEndCall={handleEndCall} />;
    if (currentView === "prescriptions") return <RecetasView />;
    if (currentView === "settings") return <SettingsView role="doctor" userName={userName} />;
    return <DoctorHome userName={userName} onNavigate={navigate} inCall={inCall} />;
  };

  return (
    <>
      {renderViewContent()}
      {inCall && currentView !== "teleconsult" && currentView !== "ai-assistant" && (
        <GlobalFloatingCallWidget
          role="doctor"
          counterpartName={activeAppointment?.patient_name || "Rosa Chávez"}
          counterpartAvatar={activeAppointment?.patient_avatar}
          appointmentId={activeAppointment?.id || 1}
          onReturnToCall={() => navigate("teleconsult")}
        />
      )}
    </>
  );
}

/* ─── MI AGENDA ─── */
function AgendaView({ userName }: { userName: string }) {
  const [allAgenda, setAllAgenda] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Estados para el calendario custom
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Estados para el Tooltip que sigue al mouse
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    if (showCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCalendar]);

  const loadAgenda = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await api.getAppointments();
      if (Array.isArray(data)) {
        const formatted = data.map((app: any) => ({
          id: app.id,
          patient: app.patient_name,
          time: new Date(app.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: app.type || "Teleconsulta",
          deaf: app.patient_name ? (app.patient_name.includes("Rosa") || app.patient_name.includes("María") || app.patient_name.includes("Morales")) : false,
          status: app.status,
          rawDate: new Date(app.date_time)
        }));
        setAllAgenda(formatted);
      }
    } catch (err) {
      console.error("Error al cargar la agenda:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadAgenda(false);
    const interval = setInterval(() => loadAgenda(true), 3000);
    return () => clearInterval(interval);
  }, []);

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

  useEffect(() => {
    const filtered = allAgenda.filter(a => isSameDay(a.rawDate, selectedDate));
    filtered.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    setAgenda(filtered);
  }, [allAgenda, selectedDate]);

  const totalHoy = agenda.length;
  const completadas = agenda.filter(item => item.status === "completada").length;
  const pendientes = agenda.filter(item => item.status === "pendiente" || item.status === "en_curso").length;

  const dateStr = selectedDate.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Lógica del calendario
  const generateMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo
    
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
    return grid;
  };

  const monthGrid = generateMonthGrid(calendarViewDate);
  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const prevMonth = () => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));

  return (
    <div className="p-6 space-y-6 anim-fade-in relative">
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0 relative z-50">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Mi Agenda</h1>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-sm font-medium" style={{ color: "#6B7280" }}>{dateCapitalized}</p>
             {!isSameDay(selectedDate, new Date()) && (
                <button onClick={() => {
                  setSelectedDate(new Date());
                  setCalendarViewDate(new Date());
                }} className="text-xs bg-[#F0FFFE] text-[#00A69D] border border-[#00C7C0] px-3 py-1 rounded-full font-bold hover:bg-[#E0F8F7] transition-all shadow-sm transform hover:scale-105 active:scale-95">
                  Volver a Hoy
                </button>
             )}
          </div>
        </div>
        <div className="flex gap-4 items-center" ref={calendarRef}>
          {/* Botón para abrir el Calendario */}
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2.5 bg-white border border-gray-200 text-[#203A70] px-4 py-2.5 rounded-xl font-bold shadow-sm hover:border-[#203A70] transition-all hover:bg-gray-50 transform active:scale-95"
          >
            <Calendar size={18} strokeWidth={2.5} className="text-[#00A69D]" />
            Cambiar Fecha
            <span className={`text-xs ml-1 transition-transform duration-300 ${showCalendar ? "rotate-180" : "rotate-0"}`}>▼</span>
          </button>

          <div className="grid grid-cols-3 gap-3 text-center ml-4">
            {[
              { label: "Total este día", value: totalHoy, color: "#203A70" },
              { label: "Completadas", value: completadas, color: "#10B981" },
              { label: "Pendientes", value: pendientes, color: "#D97706" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
                <div style={{ color: s.color, fontSize: "20px", fontWeight: 800 }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: "#9CA3AF", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Calendario Flotante (Dropdown) */}
          <div 
            className={`absolute top-24 right-6 z-[100] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-[340px] transition-all duration-300 transform origin-top-right ${showCalendar ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-4 pointer-events-none"}`}
          >
            <div className="flex justify-between items-center mb-4">
               <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 font-bold transition-colors">&lt;</button>
               <div className="font-bold text-[#203A70] capitalize text-lg">
                  {calendarViewDate.toLocaleDateString("es-DO", { month: "long", year: "numeric" })}
               </div>
               <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 font-bold transition-colors">&gt;</button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((d, i) => {
                if (!d) return <div key={i} className="h-10"></div>;
                
                const isSelected = isSameDay(d, selectedDate);
                const isToday = isSameDay(d, new Date());
                const dayApps = allAgenda.filter(a => isSameDay(a.rawDate, d));
                
                return (
                  <div 
                    key={i} 
                    className="relative flex justify-center"
                    onMouseMove={(e) => {
                      setHoveredDay(d);
                      setMousePos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <button
                      onClick={() => {
                        setSelectedDate(d);
                        setShowCalendar(false);
                        setHoveredDay(null);
                      }}
                      className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl text-sm font-bold transition-all transform hover:scale-110 active:scale-95 ${
                        isSelected ? "bg-[#203A70] text-white shadow-md" 
                        : isToday ? "bg-[#F0FFFE] text-[#00A69D] border border-[#00C7C0]" 
                        : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>{d.getDate()}</span>
                      {dayApps.length > 0 && (
                        <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white" : "bg-[#00A69D]"}`} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip Global que sigue al mouse */}
      {hoveredDay && (
        <div 
          className="fixed z-[9999] pointer-events-none bg-white/95 backdrop-blur-md text-[#203A70] text-xs rounded-2xl py-3 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[220px] overflow-hidden border border-gray-200"
          style={{
            left: mousePos.x - 240,
            top: mousePos.y - 10,
            transition: "left 0.1s ease-out, top 0.1s ease-out, opacity 0.2s"
          }}
        >
          {(() => {
            const dayApps = allAgenda.filter(a => isSameDay(a.rawDate, hoveredDay));
            return (
              <>
                <div className="font-extrabold mb-2 text-center text-[#203A70] border-b border-gray-100 pb-2 capitalize text-[13px]">
                  {hoveredDay.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {dayApps.length === 0 ? (
                  <div className="text-center text-gray-400 italic text-[11px] font-medium py-1">No hay citas</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {dayApps.slice(0,3).map((a, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[#F0FFFE] rounded-lg px-2.5 py-1.5 border border-[#00C7C0]/20">
                        <span className="text-[#00A69D] font-bold text-[10px]">{a.time}</span>
                        <span className="truncate max-w-[90px] text-right text-[#203A70] text-[10px] font-bold">{a.patient}</span>
                      </div>
                    ))}
                    {dayApps.length > 3 && <div className="text-center font-bold text-[#00A69D] mt-1 text-[10px]">+{dayApps.length - 3} más</div>}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Timeline de citas del día seleccionado */}
      <div className="space-y-3 anim-fade-in-up anim-d-2 relative z-10">
        {loading && agenda.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">Cargando agenda médica...</div>
        ) : agenda.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
             <div className="flex justify-center mb-3">
               <Calendar size={48} strokeWidth={1.5} className="text-gray-300" />
             </div>
             No hay citas programadas para este día.
          </div>
        ) : (
          agenda.map((item, i) => {
            const statusConf = {
              completada: { bg: "#F3F4F6", color: "#9CA3AF", dot: "#10B981", label: "✓ Completada" },
              en_curso: { bg: "#F0FFFE", color: "#00A69D", dot: "#00A69D", label: "● En curso" },
              confirmada: { bg: "#DCFCE7", color: "#10B981", dot: "#10B981", label: "✓ Confirmada" },
              rechazada: { bg: "#FEE2E2", color: "#EF4444", dot: "#EF4444", label: "✗ Rechazada" },
              pendiente: { bg: "white", color: "#203A70", dot: "#E5E7EB", label: "Pendiente" },
            };
            const s = statusConf[item.status as keyof typeof statusConf] || statusConf.pendiente;
            return (
              <div key={item.id} className="flex gap-4 items-stretch" style={{ opacity: item.status === "completada" ? 0.65 : 1 }}>
                {/* Línea de tiempo */}
                <div className="flex flex-col items-center" style={{ width: "40px" }}>
                  <div
                    className="w-4 h-4 rounded-full border-4 flex-shrink-0 mt-4"
                    style={{ borderColor: s.dot, background: item.status === "en_curso" ? s.dot : "white" }}
                  />
                  {i < agenda.length - 1 && <div className="flex-1 w-0.5 mt-1" style={{ background: "#E5E7EB" }} />}
                </div>

                <div
                  className="flex-1 rounded-2xl p-4 border mb-2"
                  style={{ background: s.bg, borderColor: item.status === "en_curso" ? "#00A69D" : "#E5E7EB" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>{item.time}</span>
                        <span className="text-sm" style={{ color: s.color, fontWeight: 600 }}>— {item.patient}</span>
                        {item.deaf && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
                          >
                            🤟 Sordo · LSE
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{item.type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] px-3 py-1 rounded-full"
                        style={{
                          background: item.status === "en_curso" ? "#DCFCE7" : item.status === "completada" ? "#F3F4F6" : item.status === "rechazada" ? "#FEE2E2" : "#FEF3C7",
                          color: item.status === "en_curso" ? "#10B981" : item.status === "completada" ? "#9CA3AF" : item.status === "rechazada" ? "#EF4444" : "#D97706",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px"
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


/* ─── PACIENTES ─── */
function PatientsView() {
  const [search, setSearch] = useState("");
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de Invitación
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchName, setInviteSearchName] = useState("");
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/invitations/my-patients", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((p: any) => ({
          id: p.id,
          name: p.full_name,
          age: p.age || "N/A",
          condition: p.condition || "Sin especificar",
          lastVisit: "Reciente",
          status: "estable", 
          deaf: false,
          avatar: p.avatar || p.full_name.substring(0, 2).toUpperCase(),
        }));
        setPatientsList(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSearchPatient = async () => {
    if (!inviteSearchName.trim()) return;
    setIsSearching(true);
    setInviteStatus(null);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/api/invitations/search-patient?name=${encodeURIComponent(inviteSearchName)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data);
      } else {
        setSearchResult([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInvite = async (patientId: number) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/invitations/send", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ patient_id: patientId })
      });
      if (res.ok) {
        setSearchResult(prev => prev.map(p => p.id === patientId ? { ...p, status: "pending" } : p));
      } else {
        const error = await res.json();
        console.error("Error sending invite:", error.detail);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = patientsList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.condition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5 anim-fade-in relative">
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Mis Pacientes</h1>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
          style={{ background: "#00A69D", fontWeight: 700 }}
        >
          <Plus size={16} /> Nuevo Paciente
        </button>
      </div>

      {/* Buscador local */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente en mi lista..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none focus:border-[#00A69D] transition-colors"
          style={{ borderColor: "#E5E7EB", background: "white" }}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando pacientes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-white rounded-2xl shadow-sm border border-gray-100">
          No tienes pacientes registrados o ninguno coincide con la búsqueda.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, i) => (
            <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 anim-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-shrink-0">
                  {p.avatar && (p.avatar.startsWith("http") || p.avatar.startsWith("data:")) ? (
                    <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ background: "#203A70", fontWeight: 800, fontSize: "16px" }}
                    >
                      {getAvatarInitials(p.name)}
                    </div>
                  )}
                  {p.deaf && (
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{ background: "#00A69D" }}
                    >
                      🤟
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ color: "#203A70", fontWeight: 700 }}>{p.name}</span>
                    <span className="text-sm" style={{ color: "#9CA3AF" }}>{p.age} años</span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{p.condition}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Última visita: {p.lastVisit}</div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs px-3 py-1 rounded-full border"
                    style={{
                      background: p.status === "estable" ? "#F0FFFE" : p.status === "critico" ? "#FEF2F2" : "#FFFBEB",
                      color: p.status === "estable" ? "#00A69D" : p.status === "critico" ? "#EF4444" : "#D97706",
                      borderColor: p.status === "estable" ? "#CCFBF6" : p.status === "critico" ? "#FEE2E2" : "#FEF3C7",
                      fontWeight: 600,
                    }}
                  >
                    {p.status === "estable" ? "✓ Estable" : p.status === "critico" ? "🚨 Crítico" : "⚠ Seguimiento"}
                  </span>
                  <button
                    className="px-4 py-1.5 rounded-lg text-sm border font-semibold transition-colors"
                    style={{ borderColor: "#E5E7EB", color: "#4B5563" }}
                  >
                    Ver historial
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Búsqueda Exacta (Privacidad) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm anim-fade-in" onClick={() => { setShowInviteModal(false); setSearchResult([]); setInviteSearchName(""); setInviteStatus(null); }}>
          <div 
            className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl anim-scale-in"
            style={{ border: "1px solid #E5E7EB" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>Añadir Nuevo Paciente</h3>
              <button 
                onClick={() => { setShowInviteModal(false); setSearchResult([]); setInviteSearchName(""); setInviteStatus(null); }} 
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-5">Por políticas de privacidad, debes escribir el nombre completo exacto del paciente.</p>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre del paciente</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    value={inviteSearchName}
                    onChange={(e) => setInviteSearchName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchPatient()}
                    placeholder="Ej. Brayan Mateo"
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none text-sm transition-colors focus:border-[#00A69D]"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleSearchPatient}
                disabled={isSearching}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#00A69D", boxShadow: "0 2px 10px rgba(0,166,157,0.25)" }}
              >
                {isSearching ? "Buscando..." : "Buscar paciente"}
              </button>
            </div>

            {searchResult.length > 0 && (
              <div className="space-y-3 mb-2 max-h-48 overflow-y-auto overflow-x-hidden pr-1">
                {searchResult.map(res => (
                  <div key={res.id} className="flex items-center justify-between p-3 border rounded-xl bg-white shadow-sm gap-2" style={{ borderColor: "#E5E7EB" }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                        {res.avatar && (res.avatar.startsWith("http") || res.avatar.startsWith("data:")) ? (
                          <img src={res.avatar} alt={res.full_name} className="w-full h-full object-cover" />
                        ) : (
                          getAvatarInitials(res.full_name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate" style={{ color: "#203A70" }}>{res.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{res.email}</div>
                      </div>
                    </div>
                    {res.status === "pending" ? (
                      <button 
                        disabled 
                        className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg font-bold flex-shrink-0 cursor-not-allowed border border-gray-200"
                      >
                        Invitado
                      </button>
                    ) : res.status === "accepted" ? (
                      <button 
                        disabled 
                        className="px-3 py-1.5 text-xs text-[#00A69D] bg-[#F0FFFE] rounded-lg font-bold flex-shrink-0 cursor-not-allowed border border-[#CCFBF6]"
                      >
                        Paciente
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleInvite(res.id)}
                        className="px-3 py-1.5 text-xs text-white rounded-lg hover:opacity-90 transition-opacity font-bold flex-shrink-0"
                        style={{ background: "#00A69D" }}
                      >
                        Invitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {searchResult.length === 0 && inviteSearchName && !isSearching && (
              <div className="text-center text-sm text-gray-400 py-2">No se encontraron pacientes.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const waitingPatients = [
  { name: "Rosa Chávez", time: "11:30", reason: "Seguimiento ansiedad e hipertensión", deaf: true, avatar: "RC", status: "esperando" },
  { name: "Juan Paredes", time: "14:00", reason: "Control glucemia — Diabetes Tipo 2", deaf: false, avatar: "JP", status: "en_espera" },
  { name: "Ana Morales", time: "15:30", reason: "Control prenatal — Semana 28", deaf: true, avatar: "AM", status: "en_espera" },
];

/* ─── TELECONSULTA CON TRADUCTOR IA ─── */
function TeleconsultaView({ userName, userAvatar, onEndCall }: { userName?: string; userAvatar?: string; onEndCall?: () => void }) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePatient, setActivePatient] = useState<string | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<any>(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [rx, setRx] = useState({ medicine: "", dose: "", frequency: "" });
  const [rxSubmitted, setRxSubmitted] = useState(false);
  const [doctorAvatar, setDoctorAvatar] = useState<string | undefined>(userAvatar);

  useEffect(() => {
    if (userAvatar) {
      setDoctorAvatar(userAvatar);
      return;
    }
    api.getMe().then((me) => {
      if (me && me.avatar) {
        setDoctorAvatar(me.avatar);
      }
    }).catch(() => {});
  }, [userAvatar]);

  // Modal Agendar Doctor
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [myPatients, setMyPatients] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({ patient_id: "", date: "", time: "", type: "Teleconsulta", reason: "" });
  const [patientSearchName, setPatientSearchName] = useState("");
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const scheduleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userExited = localStorage.getItem("doctor_user_left_call") === "true";
    if (userExited) return;

    const savedActive = localStorage.getItem("doctor_active_teleconsult");
    if (savedActive) {
      try {
        const parsed = JSON.parse(savedActive);
        if (parsed && parsed.id) {
          setActiveAppointment(parsed);
          setActivePatient(parsed.patient_name);
          setInCall(true);
        }
      } catch (e) {}
    }
  }, []);

  const selectedPatient = appointmentsList.find((p) => p.patient_name === activePatient) ?? null;

  const loadAppointments = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await api.getAppointments();
      if (Array.isArray(data)) {
        setAppointmentsList(data);
        const userExited = localStorage.getItem("doctor_user_left_call") === "true";
        const inProgress = data.find((a: any) => a.status === "en_curso");
        if (inProgress && !inCall && !userExited) {
          setActiveAppointment(inProgress);
          setActivePatient(inProgress.patient_name);
          setInCall(true);
          localStorage.setItem("doctor_active_teleconsult", JSON.stringify(inProgress));
        }
      }
    } catch (err) {
      console.error("Error al cargar citas:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments(false);
    const interval = setInterval(() => loadAppointments(true), 3000);
    return () => clearInterval(interval);
  }, [inCall]);

  useEffect(() => {
    if (!inCall) return;
    const t1 = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    const t2 = setInterval(() => setVisibleLines((v) => Math.min(v + 1, aiTranslations.length)), 4000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [inCall]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scheduleDropdownRef.current && !scheduleDropdownRef.current.contains(e.target as Node)) {
        setShowScheduleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSchedulePatients = myPatients.filter(p =>
    p.full_name.toLowerCase().includes(patientSearchName.toLowerCase())
  );

  const handleOpenScheduleModal = async () => {
    setShowScheduleModal(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/invitations/my-patients", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyPatients(data);
        if (data.length > 0) {
          setScheduleForm(prev => ({ ...prev, patient_id: data[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDoctorSchedule = async () => {
    if (!scheduleForm.patient_id || !scheduleForm.date || !scheduleForm.time || !scheduleForm.reason.trim()) {
      alert("Por favor llena la fecha, hora, paciente y motivo clínico.");
      return;
    }

    const selectedDateTime = new Date(`${scheduleForm.date}T${scheduleForm.time}:00`);
    if (selectedDateTime < new Date()) {
      alert("No puedes agendar una cita para una fecha/hora que ya ha pasado.");
      return;
    }

    try {
      setIsScheduling(true);
      const dateTimeStr = `${scheduleForm.date}T${scheduleForm.time}:00`;
      await api.createAppointment({
        patient_id: parseInt(scheduleForm.patient_id),
        date_time: dateTimeStr,
        type: scheduleForm.type,
        reason: scheduleForm.reason
      });
      setShowScheduleModal(false);
      setScheduleForm({ patient_id: "", date: "", time: "", type: "Teleconsulta", reason: "" });
      loadAppointments();
    } catch (err: any) {
      alert("Error agendando teleconsulta: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleUpdateStatus = async (appId: number, newStatus: string) => {
    try {
      await api.updateAppointmentStatus(appId, newStatus);
      await loadAppointments();
    } catch (err: any) {
      alert("Error actualizando cita: " + err.message);
    }
  };

  const startCall = async (patient: any) => {
    localStorage.removeItem("doctor_user_left_call");
    try {
      setActiveAppointment(patient);
      setActivePatient(patient.patient_name);
      await api.updateAppointmentStatus(patient.id, "en_curso");
      setInCall(true);
      setElapsedSecs(0);
      setVisibleLines(0);
      setRxSubmitted(false);
      setRx({ medicine: "", dose: "", frequency: "" });
    } catch (err: any) {
      alert("No se pudo iniciar la llamada: " + err.message);
    }
  };

  const endCall = async () => {
    localStorage.removeItem("doctor_active_teleconsult");
    localStorage.setItem("doctor_user_left_call", "true");
    if (selectedPatient) {
      try {
        const transcript = aiTranslations.map(t => `${t.gesture} -> ${t.translation}`).join("\n");
        await api.summarizeConsultation(selectedPatient.id, transcript);
        await api.updateAppointmentStatus(selectedPatient.id, "completada");
      } catch (err) {
        console.error("Error guardando resumen clínico:", err);
      }
    }
    setInCall(false);
    setActivePatient(null);
    setElapsedSecs(0);
    setVisibleLines(0);
    loadAppointments();
    onEndCall?.();
  };

  const handleEmitRx = async () => {
    if (!rx.medicine || !selectedPatient) return;
    try {
      await api.createPrescription({
        patient_id: selectedPatient.patient_id,
        appointment_id: selectedPatient.id,
        medicine: rx.medicine,
        dose: rx.dose || "1 comprimido",
        frequency: rx.frequency || "Cada 24 horas",
        expires_in_days: 30
      });
      setRxSubmitted(true);
    } catch (err: any) {
      alert("Error al emitir receta: " + err.message);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const pendingApps = appointmentsList.filter(a => a.status === "pendiente");
  const confirmedApps = appointmentsList.filter(a => a.status === "confirmada" || a.status === "en_curso");

  /* ── Vista de Sala de Espera / Solicitudes ── */
  if (!inCall) return (
    <div className="p-6 space-y-6 anim-fade-in relative" style={{ background: "#F9FAFB" }}>
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Sala de Espera & Telemedicina</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Gestiona las solicitudes de tus pacientes e inicia videollamadas
          </p>
        </div>
        <button
          onClick={handleOpenScheduleModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity font-bold shadow-sm"
          style={{ background: "#00A69D" }}
        >
          <Plus size={16} /> Agendar Teleconsulta
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando sala de telemedicina...</div>
      ) : (
        <div className="space-y-6">
          {/* Seccion 1: Solicitudes Pendientes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#203A70" }}>
              <Clock size={18} className="text-amber-500" /> Solicitudes Pendientes de Pacientes ({pendingApps.length})
            </h2>

            {pendingApps.length === 0 ? (
              <div className="text-sm text-gray-400 py-3 text-center">No tienes solicitudes pendientes de aprobación.</div>
            ) : (
              <div className="space-y-3">
                {pendingApps.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between p-4 border rounded-xl bg-amber-50/40 border-amber-100 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                        {apt.patient_avatar && (apt.patient_avatar.startsWith("http") || apt.patient_avatar.startsWith("data:")) ? (
                          <img src={apt.patient_avatar} alt={apt.patient_name} className="w-full h-full object-cover" />
                        ) : (
                          getAvatarInitials(apt.patient_name)
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: "#203A70" }}>{apt.patient_name}</div>
                        <div className="text-xs text-gray-600">
                          {apt.type} · {formatDateSafe(apt.date_time)}
                        </div>
                        {apt.reason && (
                          <div className="text-xs text-gray-700 font-medium mt-1 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                            <strong>Motivo:</strong> {apt.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(apt.id, "confirmada")}
                        className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
                        style={{ background: "#00A69D" }}
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(apt.id, "rechazada")}
                        className="px-3.5 py-1.5 rounded-lg text-gray-600 text-xs font-bold border border-gray-200 hover:bg-gray-100 bg-white transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seccion 2: Sala de Espera (Confirmadas) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#203A70" }}>
              <Video size={18} className="text-[#00A69D]" /> Citas Confirmadas / Sala de Espera ({confirmedApps.length})
            </h2>

            {confirmedApps.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No hay pacientes esperando teleconsulta en este momento.</div>
            ) : (
              <div className="space-y-3">
                {confirmedApps.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between p-4 border rounded-xl bg-white border-gray-100 flex-wrap gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#203A70] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden">
                        {apt.patient_avatar && (apt.patient_avatar.startsWith("http") || apt.patient_avatar.startsWith("data:")) ? (
                          <img src={apt.patient_avatar} alt={apt.patient_name} className="w-full h-full object-cover" />
                        ) : (
                          getAvatarInitials(apt.patient_name)
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2" style={{ color: "#203A70" }}>
                          {apt.patient_name}
                          {(apt.patient_name.includes("Rosa") || apt.patient_name.includes("María") || apt.patient_name.includes("Morales")) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0FFFE] text-[#00A69D] border border-[#00C7C0] font-semibold">
                              🤟 Sordo · LSE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {apt.type} · {formatDateSafe(apt.date_time)}
                        </div>
                        {apt.reason && (
                          <div className="text-xs text-gray-600 mt-1 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                            <strong>Motivo:</strong> {apt.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => startCall(apt)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                      style={{ background: "#00A69D" }}
                    >
                      <Video size={16} /> Iniciar Videollamada
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Agendar Teleconsulta Doctor */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm anim-fade-in" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>Agendar Teleconsulta</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="relative" ref={scheduleDropdownRef}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Paciente</label>
                <input
                  type="text"
                  value={patientSearchName}
                  onFocus={() => setShowScheduleDropdown(true)}
                  onChange={(e) => {
                    setPatientSearchName(e.target.value);
                    setScheduleForm({ ...scheduleForm, patient_id: "" });
                    setShowScheduleDropdown(true);
                  }}
                  placeholder="Escribe para buscar paciente de tu lista..."
                  className="w-full px-3 py-2.5 border rounded-xl outline-none focus:border-[#00A69D] text-sm transition-colors"
                  style={{ borderColor: "#E5E7EB" }}
                />

                {showScheduleDropdown && filteredSchedulePatients.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredSchedulePatients.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPatientSearchName(p.full_name);
                          setScheduleForm({ ...scheduleForm, patient_id: p.id.toString() });
                          setShowScheduleDropdown(false);
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-[#F0FFFE] cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                          {p.avatar && (p.avatar.startsWith("http") || p.avatar.startsWith("data:")) ? (
                            <img src={p.avatar} alt={p.full_name} className="w-full h-full object-cover" />
                          ) : (
                            getAvatarInitials(p.full_name)
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: "#203A70" }}>{p.full_name}</div>
                          <div className="text-xs text-gray-500">{p.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hora</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo clínico</label>
                <textarea
                  value={scheduleForm.reason}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                  placeholder="Escribe el motivo o nota clínica para esta cita (ej. Control de hipertensión)..."
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#00A69D] h-20 resize-none"
                />
              </div>

              <button
                onClick={handleDoctorSchedule}
                disabled={isScheduling || myPatients.length === 0}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md"
                style={{ background: "#00A69D" }}
              >
                {isScheduling ? "Agendando..." : "Confirmar Teleconsulta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Vista en llamada unificada ── */
  return (
    <TelemedicinaRoom
      role="doctor"
      userName={userName || "Dr. Jose Matos"}
      userAvatar={doctorAvatar || userAvatar}
      counterpartName={activeAppointment?.patient_name || selectedPatient?.patient_name || activePatient || "Paciente"}
      counterpartAvatar={activeAppointment?.patient_avatar || selectedPatient?.patient_avatar}
      patientId={activeAppointment?.patient_id || selectedPatient?.patient_id || selectedPatient?.id}
      appointmentId={activeAppointment?.id || selectedPatient?.id}
      appointmentReason={activeAppointment?.reason || selectedPatient?.reason}
      onEndCall={endCall}
      onEmitRxSuccess={() => {
        loadAppointments();
      }}
    />
  );
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

/* ─── RECETAS ─── */
function RecetasView() {
  const [form, setForm] = useState({ patient: "", medicine: "", dose: "", frequency: "" });
  const [myPatients, setMyPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMedSuggestions, setShowMedSuggestions] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const medSuggestions = ragMedicines.filter((m) =>
    m.name.toLowerCase().includes(form.medicine.toLowerCase().trim())
  );

  useEffect(() => {
    async function loadPatients() {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch("http://localhost:8000/api/invitations/my-patients", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMyPatients(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPatients = myPatients.filter(p =>
    p.full_name.toLowerCase().includes(form.patient.toLowerCase())
  );

  const handleSelectPatient = (p: any) => {
    setForm({ ...form, patient: p.full_name });
    setSelectedPatientId(p.id);
    setShowDropdown(false);
  };

  const handleEmit = async () => {
    if (!form.medicine || !form.patient) {
      alert("Por favor completa el paciente y el medicamento.");
      return;
    }
    
    // Find patient ID if not explicitly selected
    let patId = selectedPatientId;
    if (!patId) {
      const match = myPatients.find(p => p.full_name.toLowerCase() === form.patient.toLowerCase());
      if (match) patId = match.id;
    }

    if (!patId) {
      alert("Debes seleccionar un paciente válido de tu lista de pacientes vinculados.");
      return;
    }

    try {
      setLoading(true);
      await api.createPrescription({
        patient_id: patId,
        medicine: form.medicine,
        dose: form.dose || "1 comprimido",
        frequency: form.frequency || "Cada 24 horas",
        expires_in_days: 30
      });
      setSubmitted(true);
    } catch (err: any) {
      alert("Error emitiendo receta: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Emitir Receta Digital</h1>

      {submitted ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center anim-scale-in max-w-2xl">
          <CheckCircle size={56} style={{ color: "#10B981", margin: "0 auto 16px" }} />
          <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "20px" }}>Receta Emitida y Geolocalizada</h2>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
            La receta fue enviada al paciente y notificada a las farmacias en su radio cercano.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm({ patient: "", medicine: "", dose: "", frequency: "" });
              setSelectedPatientId(null);
            }}
            className="mt-6 px-8 py-3 rounded-xl text-white font-bold transition-opacity hover:opacity-90 shadow-sm"
            style={{ background: "#00A69D" }}
          >
            Nueva Receta
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm max-w-2xl anim-fade-in-up anim-d-1">
          <div className="space-y-4">
            {/* Campo Paciente con Autocomplete */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Paciente</label>
              <input
                value={form.patient}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setForm({ ...form, patient: e.target.value });
                  setSelectedPatientId(null);
                  setShowDropdown(true);
                }}
                placeholder="Escribe para buscar paciente de tu lista..."
                className="w-full px-4 py-3 rounded-xl border outline-none text-sm transition-colors focus:border-[#00A69D]"
                style={{ borderColor: "#E5E7EB" }}
              />

              {showDropdown && filteredPatients.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {filteredPatients.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="flex items-center gap-3 p-3 hover:bg-[#F0FFFE] cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                        {p.avatar && (p.avatar.startsWith("http") || p.avatar.startsWith("data:")) ? (
                          <img src={p.avatar} alt={p.full_name} className="w-full h-full object-cover" />
                        ) : (
                          getAvatarInitials(p.full_name)
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "#203A70" }}>{p.full_name}</div>
                        <div className="text-xs text-gray-500">{p.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medicamento con Autocompletado */}
            <div className="relative">
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Medicamento</label>
              <input
                value={form.medicine}
                onFocus={() => setShowMedSuggestions(true)}
                onBlur={() => setTimeout(() => setShowMedSuggestions(false), 150)}
                onChange={(e) => {
                  setForm({ ...form, medicine: e.target.value });
                  setShowMedSuggestions(true);
                }}
                placeholder="Ej: Atorvastatina 20mg, Losartán 50mg..."
                className="w-full px-4 py-3 rounded-xl border outline-none text-sm focus:border-[#00A69D]"
                style={{ borderColor: "#E5E7EB" }}
              />

              {showMedSuggestions && form.medicine.trim().length > 0 && medSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#00A69D] rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-gray-100 z-50">
                  {medSuggestions.map((sug) => (
                    <button
                      key={sug.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setForm({
                          ...form,
                          medicine: sug.name,
                          dose: form.dose || sug.defaultDose,
                          frequency: form.frequency || sug.defaultFreq,
                        });
                        setShowMedSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 text-xs flex items-center justify-between text-gray-700 transition-colors cursor-pointer"
                    >
                      <span className="font-bold text-[#203A70] flex items-center gap-2">
                        <Pill size={14} className="text-[#00A69D]" /> {sug.name}
                      </span>
                      <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {sug.defaultDose}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dosis */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Dosis</label>
              <input
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
                placeholder="Ej: 1 comprimido"
                className="w-full px-4 py-3 rounded-xl border outline-none text-sm focus:border-[#00A69D]"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>

            {/* Frecuencia */}
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Frecuencia</label>
              <input
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder="Ej: Cada 24 horas por 30 días"
                className="w-full px-4 py-3 rounded-xl border outline-none text-sm focus:border-[#00A69D]"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          </div>

          <button
            onClick={handleEmit}
            disabled={loading}
            className="w-full mt-6 py-4 rounded-xl text-white flex items-center justify-center gap-2 font-extrabold text-base transition-opacity hover:opacity-90 disabled:opacity-50 shadow-md"
            style={{ background: "#00A69D" }}
          >
            <Zap size={20} /> {loading ? "Emitiendo..." : "Emitir y Geolocalizar Receta"}
          </button>
        </div>
      )}
    </div>
  );
}
