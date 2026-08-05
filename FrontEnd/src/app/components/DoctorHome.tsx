import { useState, useEffect } from "react";
import { Video, FileText, Users, Clock, Stethoscope, CheckCircle, Bell, ChevronRight, CalendarDays, Activity } from "lucide-react";
import { api } from "../utils/api";

interface DoctorHomeProps {
  userName: string;
  onNavigate: (view: string) => void;
  inCall?: boolean;
}

const notifications = [
  { icon: <CheckCircle size={14} style={{ color: "#10B981" }} />, text: "2 recetas validadas por Farmacia Suiza Plus · San Pedro de Macorís", time: "Hace 8 min", dot: "#10B981" },
  { icon: <Bell size={14} style={{ color: "#D97706" }} />, text: "Rosa Chávez se conectó a la sala de espera virtual", time: "Hace 3 min", dot: "#D97706" },
  { icon: <CheckCircle size={14} style={{ color: "#00A69D" }} />, text: "Receta RX-2026-0839 de María López fue despachada", time: "Hace 22 min", dot: "#00A69D" },
];

function getAvatarInitials(name?: string): string {
  if (!name) return "PA";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export function DoctorHome({ userName, onNavigate, inCall }: DoctorHomeProps) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const lastName = (userName || "Médico").split(" ").slice(-1)[0] || "Médico";
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/invitations/all-notifications", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const clearedKey = `cleared_notifs_${userName}`;
          const clearedIds: string[] = JSON.parse(localStorage.getItem(clearedKey) || "[]");
          const active = data.filter((n: any) => !clearedIds.includes(n.id));
          setNotificationsList(active.slice(0, 3));
        }
      }
    } catch (e) {}
  };

  const loadAppointments = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await api.getAppointments();
      if (Array.isArray(data)) {
        const formatted = data.map((app: any) => ({
          id: app.id,
          patient_id: app.patient_id,
          name: app.patient_name,
          patient_avatar: app.patient_avatar,
          date_time_raw: app.date_time,
          time: new Date(app.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          condition: app.reason || "Consulta de control",
          deaf: app.patient_name ? (app.patient_name.includes("Rosa") || app.patient_name.includes("María") || app.patient_name.includes("Morales")) : false,
          type: app.type,
          avatar: getAvatarInitials(app.patient_name),
          status: app.status
        }));

        const isSameDay = (d1: Date, d2: Date) => 
          d1.getFullYear() === d2.getFullYear() && 
          d1.getMonth() === d2.getMonth() && 
          d1.getDate() === d2.getDate();

        const todayApps = formatted.filter((app: any) => 
          isSameDay(new Date(app.date_time_raw), new Date())
        );

        setAppointmentsList(todayApps);
      }
    } catch (err) {
      console.error("Error al cargar agenda:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments(false);
    loadNotifications();
    const interval = setInterval(() => {
      loadAppointments(true);
      loadNotifications();
    }, 3000);
    return () => clearInterval(interval);
  }, [userName]);

  // Filtrar próximo paciente (que esté pendiente o en curso)
  const nextPatient = appointmentsList.find(app => app.status === "en_curso") ||
                      appointmentsList.find(app => app.status === "confirmada") ||
                      appointmentsList.find(app => app.status === "pendiente");

  // Métricas dinámicas calculadas de la agenda real del día
  const totalHoy = appointmentsList.length;
  const completadas = appointmentsList.filter(app => app.status === "completada").length;
  const pendientes = appointmentsList.filter(app => app.status === "pendiente").length;
  const telemedicinaLSE = appointmentsList.filter(app => app.deaf).length;

  return (
    <div className="p-6 space-y-6 anim-fade-in" style={{ background: "#F9FAFB" }}>

      {/* ── Saludo ── */}
      <div className="anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>
          {greeting}, Dr. {lastName}
        </h1>
        <p className="mt-1 text-sm flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
          <CalendarDays size={13} />
          {dateCapitalized}
        </p>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-fade-in-up anim-d-1">
        {[
          { label: "Consultas hoy", value: totalHoy, icon: <Stethoscope size={18} />, bg: "#EEF2FF", color: "#203A70" },
          { label: "Completadas", value: completadas, icon: <CheckCircle size={18} />, bg: "#DCFCE7", color: "#10B981" },
          { label: "Pendientes", value: pendientes, icon: <Clock size={18} />, bg: "#FEF3C7", color: "#D97706" },
          { label: "Telemedicina LSE", value: telemedicinaLSE, icon: <Activity size={18} />, bg: "#F0FFFE", color: "#00A69D" },
        ].map((m, i) => (
          <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm anim-fade-in-up" style={{ animationDelay: `${60 + i * 60}ms` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: m.bg }}>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <div style={{ color: "#203A70", fontSize: "26px", fontWeight: 800, lineHeight: 1 }}>{m.value}</div>
            <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Sección central: próximo paciente + atajos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 anim-fade-in-up anim-d-2">

        {/* Próximo paciente — 60% */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Tarjeta destacada */}
          {nextPatient ? (
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #203A70 0%, #1a4f8a 55%, #00A69D 100%)",
                boxShadow: "0 4px 24px rgba(32,58,112,0.18)",
              }}
            >
              {/* Decoración */}
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: "white" }} />
              <div className="absolute right-12 bottom-0 w-20 h-20 rounded-full opacity-10" style={{ background: "#00C7C0" }} />

              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm uppercase tracking-wider text-cyan-200 font-bold flex items-center gap-1.5">
                    {nextPatient.status === "en_curso" ? (
                      <>
                        <span
                          className="flex h-2.5 w-2.5 rounded-full mr-1"
                          style={{
                            background: "#008f87",
                            boxShadow: "0 0 0 3px rgba(0,166,157,0.2)"
                          }}
                        ></span>
                        Paciente en curso · {nextPatient.time}
                      </>
                    ) : (
                      <>
                        {nextPatient.status === "pendiente" ? "Paciente en espera de confirmación" : "Próximo paciente"} · {nextPatient.time}
                      </>
                    )}
                  </span>
                  {nextPatient.deaf && (
                    <>
                      <span className="text-cyan-200/50">•</span>
                      <span className="text-sm font-bold text-cyan-300">
                        LSE requerido
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0 overflow-hidden font-bold"
                    style={{ background: "rgba(255,255,255,0.15)", fontSize: "20px", border: "2px solid rgba(255,255,255,0.3)" }}
                  >
                    {nextPatient.patient_avatar && (nextPatient.patient_avatar.startsWith("http") || nextPatient.patient_avatar.startsWith("data:")) ? (
                      <img src={nextPatient.patient_avatar} alt={nextPatient.name} className="w-full h-full object-cover" />
                    ) : (
                      getAvatarInitials(nextPatient.name)
                    )}
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-extrabold">{nextPatient.name}</h2>
                    <p className="text-white/80 text-base font-medium mt-1">Condición: {nextPatient.condition}</p>
                    <p className="text-white/60 text-sm mt-0.5">{nextPatient.type}</p>
                  </div>
                </div>

                {(() => {
                  const now = new Date();
                  const appTime = new Date(nextPatient.date_time_raw);
                  const diffMinutes = (appTime.getTime() - now.getTime()) / 60000;
                  const isSameDay = (d1: Date, d2: Date) => 
                    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

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
                  
                  if (nextPatient.status === "pendiente") {
                    return (
                      <button
                        onClick={() => onNavigate("teleconsult")}
                        className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm transition-all"
                        style={{ background: "#F59E0B", color: "white", fontWeight: 800, fontSize: "15px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#D97706")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#F59E0B")}
                      >
                        <Video size={18} />
                        Cita Pendiente (Gestionar en Sala de Espera)
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={() => onNavigate("teleconsult")}
                      className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm transition-all"
                      style={{ background: "#00A69D", color: "white", fontWeight: 800, fontSize: "15px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
                    >
                      <Video size={18} />
                      {inCall || nextPatient?.status === "en_curso" || !!localStorage.getItem("doctor_active_teleconsult")
                        ? "Volver a Sala de Telemedicina"
                        : "Entrar a Sala de Telemedicina"}
                    </button>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-6 text-center bg-white border"
              style={{
                borderColor: "#E5E7EB",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                minHeight: "180px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              <CheckCircle size={40} style={{ color: "#10B981", marginBottom: "12px" }} />
              <h3 style={{ color: "#203A70", fontWeight: 700, fontSize: "18px" }}>¡Todo al día!</h3>
              <p className="text-sm mt-1" style={{ color: "#6B7280" }}>No tienes más consultas de telemedicina pendientes hoy.</p>
            </div>
          )}

          {/* Cola de citas del día */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6" }}>
              <span className="text-xs" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Agenda de hoy
              </span>
              <span className="text-xs text-gray-400 font-semibold">
                Mostrando {Math.min(3, appointmentsList.length)} de {appointmentsList.length}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {loading ? (
                <div className="text-center py-6 text-gray-500 text-sm">Cargando agenda...</div>
              ) : appointmentsList.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">No hay citas programadas para hoy.</div>
              ) : (
                appointmentsList.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5" style={{ opacity: p.status === "completada" ? 0.6 : 1 }}>
                    <span className="text-sm flex-shrink-0" style={{ color: "#9CA3AF", fontWeight: 600, width: "48px" }}>{p.time}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 overflow-hidden font-bold"
                      style={{ background: p.status === "en_curso" ? "#00A69D" : "#203A70" }}
                    >
                      {p.patient_avatar && (p.patient_avatar.startsWith("http") || p.patient_avatar.startsWith("data:")) ? (
                        <img src={p.patient_avatar} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        getAvatarInitials(p.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{p.name}</span>
                        {p.deaf && <span className="text-xs" style={{ color: "#00A69D" }}>🤟</span>}
                      </div>
                      <span className="text-xs" style={{ color: "#9CA3AF" }}>{p.type}</span>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full flex-shrink-0 capitalize"
                      style={{
                        background: p.status === "en_curso" ? "#DCFCE7" : p.status === "completada" ? "#F3F4F6" : p.status === "confirmada" ? "#E0F2FE" : p.status === "rechazada" ? "#FEE2E2" : "#FEF3C7",
                        color: p.status === "en_curso" ? "#10B981" : p.status === "completada" ? "#9CA3AF" : p.status === "confirmada" ? "#0284C7" : p.status === "rechazada" ? "#EF4444" : "#D97706",
                        fontWeight: 600,
                      }}
                    >
                      {p.status === "en_curso" ? "En curso" : p.status === "completada" ? "Completada" : p.status === "confirmada" ? "Confirmada" : p.status === "rechazada" ? "Rechazada" : "Pendiente"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Atajos y notificaciones — 40% */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Atajos rápidos */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor: "#F3F4F6" }}>
              <span className="text-xs" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Acciones rápidas
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {[
                { icon: <FileText size={18} style={{ color: "#00A69D" }} />, label: "Generar Receta Nueva", desc: "Emitir y geolocalizar", bg: "#F0FFFE", view: "prescriptions" },
                { icon: <Users size={18} style={{ color: "#203A70" }} />, label: "Ver Expedientes", desc: "Historial de pacientes", bg: "#EEF2FF", view: "patients" },
                { icon: <Video size={18} style={{ color: "#00A69D" }} />, label: "Sala de Telemedicina", desc: "Iniciar consulta ahora", bg: "#F0FFFE", view: "teleconsult" },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(a.view)}
                  className="w-full flex items-center gap-3.5 px-5 py-4 text-left transition-all cursor-pointer"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F9FAFB")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{a.label}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>{a.desc}</p>
                  </div>
                  <ChevronRight size={15} style={{ color: "#D1D5DB", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Notificaciones */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F3F4F6" }}>
              <span className="text-xs" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Notificaciones
              </span>
              {notificationsList.length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#FEE2E2", color: "#EF4444", fontWeight: 700 }}
                >
                  {notificationsList.length} nuevas
                </span>
              )}
            </div>
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {notificationsList.length > 0 ? (
                notificationsList.slice(0, 3).map((n, i) => (
                  <div key={n.id || i} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: "#00A69D" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{n.title || "Notificación de Sistema"}</p>
                      <p className="text-xs text-gray-600 leading-snug mt-0.5">{n.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">Sin notificaciones recientes.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
