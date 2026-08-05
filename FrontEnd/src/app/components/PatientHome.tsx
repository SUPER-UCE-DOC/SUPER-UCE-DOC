import { useState, useEffect } from "react";
import { Video, Calendar, MessageSquareHeart, Pill, ChevronRight, Clock, Activity } from "lucide-react";
import { api } from "../utils/api";

interface PatientHomeProps {
  userName: string;
  onNavigate: (view: string) => void;
  onJoinCall?: (apt: any) => void;
  inCall?: boolean;
}

function LiveHomeBadge({ roomCode }: { roomCode: number }) {
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
    <div className="flex items-center gap-2 text-sm text-cyan-300 font-bold">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
      </span>
      En Curso · {m}:{s}
    </div>
  );
}

function formatDateSafe(dateStr?: string) {
  if (!dateStr) return "Hoy";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-DO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return dateStr;
  }
}

export function PatientHome({ userName, onNavigate, onJoinCall, inCall }: PatientHomeProps) {
  const firstName = (userName || "Paciente").split(" ")[0];
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apts = await api.getAppointments();
        if (Array.isArray(apts)) setAppointmentsList(apts);
      } catch (e) {}

      try {
        const rxs = await api.getPrescriptions();
        if (Array.isArray(rxs)) setPrescriptionsList(rxs);
      } catch (e) {}
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const nextApp = appointmentsList.find(a => a.status === "en_curso") ||
                  appointmentsList.find(a => a.status === "confirmada") ||
                  appointmentsList.find(a => a.status === "pendiente") || null;

  // Build dynamic recent activity timeline from real appointments & prescriptions
  const recentActivities: any[] = [];

  appointmentsList.forEach(apt => {
    if (apt.status === "completada") {
      recentActivities.push({
        id: `apt_${apt.id}`,
        icon: <Activity size={15} style={{ color: "#00A69D" }} />,
        title: "Consulta completada",
        desc: `Teleconsulta con ${apt.doctor_name || "Doctor"}`,
        time: formatDateSafe(apt.date_time),
        rawDate: apt.date_time
      });
    } else if (apt.status === "confirmada" || apt.status === "en_curso") {
      recentActivities.push({
        id: `apt_${apt.id}`,
        icon: <Calendar size={15} style={{ color: "#203A70" }} />,
        title: apt.status === "en_curso" ? "Consulta en curso" : "Cita confirmada",
        desc: `Teleconsulta con ${apt.doctor_name || "Doctor"}`,
        time: formatDateSafe(apt.date_time),
        rawDate: apt.date_time
      });
    }
  });

  prescriptionsList.forEach(rx => {
    recentActivities.push({
      id: `rx_${rx.id}`,
      icon: <Pill size={15} style={{ color: "#D97706" }} />,
      title: "Receta emitida",
      desc: `${rx.medicine} (${rx.dose || "Dosis prescrita"})`,
      time: formatDateSafe(rx.created_at),
      rawDate: rx.created_at
    });
  });

  recentActivities.sort((a, b) => {
    const da = new Date(a.rawDate || 0).getTime();
    const db = new Date(b.rawDate || 0).getTime();
    return db - da; // Más nueva a más vieja
  });

  const activePrescriptionsCount = prescriptionsList.filter(rx => rx.status === "activa").length;

  return (
    <div className="p-6 space-y-6 anim-fade-in" style={{ background: "#F9FAFB" }}>

      {/* ── Bienvenida ── */}
      <div className="anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>
          Hola de nuevo, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
          ¿Cómo podemos ayudarte a cuidar tu salud hoy?
        </p>
      </div>

      {/* ── Próxima cita — tarjeta destacada ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden anim-fade-in-up anim-d-1"
        style={{
          background: "linear-gradient(135deg, #203A70 0%, #1a4f8a 60%, #00A69D 100%)",
          boxShadow: "0 4px 24px rgba(32,58,112,0.18)",
        }}
      >
        {/* Decoración de fondo */}
        <div
          className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: "white" }}
        />
        <div
          className="absolute right-16 bottom-0 w-24 h-24 rounded-full opacity-10"
          style={{ background: "#00C7C0" }}
        />

        <div className="relative">
          <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-wide uppercase mb-3" style={{ color: "rgba(255,255,255,0.9)" }}>
            <Clock size={15} /> Tu próxima cita médica
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-white text-2xl font-extrabold mb-1">
                {nextApp ? (nextApp.doctor_name || "Doctor Especialista") : "No tienes citas agendadas"}
              </h2>
              
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                {nextApp ? (
                  <>
                    <span>{nextApp.type || "Teleconsulta"}</span>
                    {(nextApp.doctor_specialty || nextApp.specialty) && (
                      <>
                        <span className="opacity-50">•</span>
                        <span>{nextApp.doctor_specialty || nextApp.specialty}</span>
                      </>
                    )}
                    {nextApp.reason && (
                      <>
                        <span className="opacity-50">•</span>
                        <span>{nextApp.reason}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span>Solicita una teleconsulta médica cuando lo necesites</span>
                )}
              </div>

              {nextApp && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Calendar size={15} style={{ color: "#00C7C0" }} />
                    {formatDateSafe(nextApp.date_time)}
                  </div>
                  
                  {nextApp.status === "en_curso" && (
                    <LiveHomeBadge roomCode={nextApp.id} />
                  )}
                </div>
              )}
            </div>

            {nextApp && nextApp.status === "en_curso" ? (
              <button
                onClick={() => onJoinCall?.(nextApp)}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm whitespace-nowrap transition-all hover:opacity-90 cursor-pointer"
                style={{
                  background: "#00A69D",
                  color: "white",
                  fontWeight: 800,
                  fontSize: "15px",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                }}
              >
                <Video size={18} />
                {inCall || !!localStorage.getItem("patient_active_teleconsult")
                  ? "Volver a la Sala de Telemedicina"
                  : "Entrar a la Sala de Telemedicina"}
              </button>
            ) : nextApp && nextApp.status === "confirmada" ? (
              (() => {
                const isSameDay = (d1: Date, d2: Date) => 
                  d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
                
                const now = new Date();
                const appTime = new Date(nextApp.date_time_raw || nextApp.date_time);
                const isTooEarly = !isSameDay(appTime, now);
                
                const formatRelativeDate = (date: Date) => {
                  const today = new Date();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  if (isSameDay(date, today)) return "Hoy";
                  if (isSameDay(date, tomorrow)) return "Mañana";
                  return `el ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
                };
                
                if (isTooEarly) {
                  return (
                    <button
                      disabled
                      className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm whitespace-nowrap transition-all bg-white/20 text-white font-bold opacity-60 cursor-not-allowed"
                    >
                      <Clock size={18} />
                      Disponible {formatRelativeDate(appTime)} a las {appTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  );
                }
                
                return (
                  <button
                    onClick={() => alert("El médico debe presionar 'Iniciar Videollamada' en su panel. En cuanto la inicie, este botón se activará automáticamente.")}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm whitespace-nowrap transition-all bg-white/20 text-white font-bold opacity-90 cursor-pointer"
                  >
                    <Clock size={18} />
                    Esperando al Médico
                  </button>
                );
              })()
            ) : (
              <button
                onClick={() => onNavigate(nextApp ? "appointments" : "appointments_new")}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm whitespace-nowrap transition-all font-bold text-white shadow-md cursor-pointer"
                style={{ background: "#00A69D" }}
              >
                <Calendar size={18} />
                {nextApp ? "Ver Mis Citas" : "Agendar Cita Médica"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div className="anim-fade-in-up anim-d-2">
        <h2 className="text-sm mb-3" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Agendar cita */}
          <button
            onClick={() => onNavigate("appointments_new")}
            className="bg-white rounded-2xl p-5 text-left shadow-sm group transition-all cursor-pointer"
            style={{ border: "1px solid #F3F4F6" }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EEF2FF" }}>
              <Calendar size={24} style={{ color: "#203A70" }} />
            </div>
            <p style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>Agendar Cita Médica</p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Ver disponibilidad de especialistas</p>
            <div className="flex items-center gap-1 mt-4 text-sm" style={{ color: "#00A69D", fontWeight: 600 }}>
              Ver agenda <ChevronRight size={13} />
            </div>
          </button>

          {/* Asistente IA */}
          <button
            onClick={() => onNavigate("ai-assistant")}
            className="bg-white rounded-2xl p-5 text-left shadow-sm transition-all cursor-pointer"
            style={{ border: "1px solid #F3F4F6" }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#F0FFFE" }}>
              <MessageSquareHeart size={24} style={{ color: "#00A69D" }} />
            </div>
            <p style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>Consultar Asistente IA</p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Resuelve dudas sobre tu salud 24/7</p>
            <div className="flex items-center gap-1 mt-4 text-sm" style={{ color: "#00A69D", fontWeight: 600 }}>
              Abrir chat <ChevronRight size={13} />
            </div>
          </button>

          {/* Mis recetas */}
          <button
            onClick={() => onNavigate("prescriptions")}
            className="bg-white rounded-2xl p-5 text-left shadow-sm transition-all relative cursor-pointer"
            style={{ border: "1px solid #F3F4F6" }}
          >
            {activePrescriptionsCount > 0 && (
              <span 
                className="absolute top-4 right-4 text-sm px-4 py-1.5 rounded-lg border font-bold bg-green-50 text-green-600 border-green-200"
              >
                {activePrescriptionsCount} {activePrescriptionsCount === 1 ? "Activa" : "Activas"}
              </span>
            )}

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF3C7" }}>
              <Pill size={24} style={{ color: "#D97706" }} />
            </div>
            <p style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>Mis Recetas Activas</p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Ver y localizar farmacias cercanas</p>
            <div className="flex items-center gap-1 mt-4 text-sm" style={{ color: "#00A69D", fontWeight: 600 }}>
              Ver recetas <ChevronRight size={13} />
            </div>
          </button>

        </div>
      </div>

      {/* ── Estado de salud reciente ── */}
      <div className="anim-fade-in-up anim-d-3">
        <h2 className="text-sm mb-3" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Actividad reciente
        </h2>

        {recentActivities.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm divide-y" style={{ border: "1px solid #F3F4F6" }}>
            {recentActivities.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F9FAFB" }}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{item.title}</p>
                  <p className="text-sm mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{item.desc}</p>
                </div>
                <span className="text-sm flex-shrink-0" style={{ color: "#9CA3AF" }}>{item.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center" style={{ border: "1px solid #F3F4F6" }}>
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-600">Sin actividad reciente registrada</p>
            <p className="text-sm text-gray-400 mt-1">Tus consultas finalizadas y recetas emitidas aparecerán automáticamente en esta sección.</p>
          </div>
        )}
      </div>

    </div>
  );
}
