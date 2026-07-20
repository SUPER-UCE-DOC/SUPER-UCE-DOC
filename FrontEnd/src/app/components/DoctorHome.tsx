import { useState, useEffect } from "react";
import { Video, FileText, Users, Clock, Stethoscope, CheckCircle, Bell, ChevronRight, CalendarDays, Activity } from "lucide-react";
import { api } from "../utils/api";

interface DoctorHomeProps {
  userName: string;
  onNavigate: (view: string) => void;
}

const notifications = [
  { icon: <CheckCircle size={14} style={{ color: "#10B981" }} />, text: "2 recetas validadas por Farmacia Suiza Plus · San Pedro de Macorís", time: "Hace 8 min", dot: "#10B981" },
  { icon: <Bell size={14} style={{ color: "#D97706" }} />, text: "Rosa Chávez se conectó a la sala de espera virtual", time: "Hace 3 min", dot: "#D97706" },
  { icon: <CheckCircle size={14} style={{ color: "#00A69D" }} />, text: "Receta RX-2026-0839 de María López fue despachada", time: "Hace 22 min", dot: "#00A69D" },
];

export function DoctorHome({ userName, onNavigate }: DoctorHomeProps) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const lastName = userName.split(" ").slice(-1)[0] || userName;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      const formatted = data.map((app: any) => ({
        id: app.id,
        patient_id: app.patient_id,
        name: app.patient_name,
        time: new Date(app.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        condition: app.reason || "Consulta de control",
        deaf: app.patient_name.includes("Rosa") || app.patient_name.includes("María") || app.patient_name.includes("Morales"),
        type: app.type,
        avatar: app.patient_name.substring(0, 2).toUpperCase(),
        status: app.status
      }));
      setAppointmentsList(formatted);
    } catch (err) {
      console.error("Error al cargar agenda:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  // Filtrar próximo paciente (que esté pendiente o en curso)
  const nextPatient = appointmentsList.find(app => app.status === "pendiente" || app.status === "en_curso");

  // Métricas dinámicas calculadas de la agenda real del día
  const totalHoy = appointmentsList.length;
  const completadas = appointmentsList.filter(app => app.status === "completada").length;
  const pendientes = appointmentsList.filter(app => app.status === "pendiente" || app.status === "en_curso").length;
  const telemedicinaLSE = appointmentsList.filter(app => app.deaf).length;

  return (
    <div className="p-6 space-y-6 anim-fade-in" style={{ background: "#F9FAFB", minHeight: "100vh" }}>

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
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600 }}>
                    <Clock size={11} className="inline mr-1" />
                    Próximo paciente · {nextPatient.time}
                  </span>
                  {nextPatient.deaf && (
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(0,199,192,0.25)", color: "#00C7C0", fontWeight: 700 }}>
                      🤟 LSE requerido
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.15)", fontSize: "20px", fontWeight: 800, border: "2px solid rgba(255,255,255,0.3)" }}
                  >
                    {nextPatient.avatar}
                  </div>
                  <div>
                    <h2 className="text-white" style={{ fontSize: "20px", fontWeight: 800 }}>{nextPatient.name}</h2>
                    <p style={{ color: "rgba(255,255,255,0.70)", fontSize: "14px" }}>{nextPatient.condition}</p>
                    <p style={{ color: "rgba(255,255,255,0.50)", fontSize: "12px", marginTop: "2px" }}>{nextPatient.type}</p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate("teleconsult")}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm transition-all"
                  style={{ background: "#00A69D", color: "white", fontWeight: 800, fontSize: "15px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
                >
                  <Video size={18} />
                  Entrar a Sala de Telemedicina
                </button>
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
            <div className="px-5 py-3 border-b" style={{ borderColor: "#F3F4F6" }}>
              <span className="text-xs" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Agenda de hoy
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {loading ? (
                <div className="text-center py-6 text-gray-500 text-sm">Cargando agenda...</div>
              ) : appointmentsList.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">No hay citas programadas para hoy.</div>
              ) : (
                appointmentsList.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5" style={{ opacity: p.status === "completada" ? 0.6 : 1 }}>
                    <span className="text-sm flex-shrink-0" style={{ color: "#9CA3AF", fontWeight: 600, width: "48px" }}>{p.time}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                      style={{ background: p.status === "en_curso" ? "#00A69D" : "#203A70", fontWeight: 700 }}
                    >
                      {p.avatar}
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
                        background: p.status === "en_curso" ? "#DCFCE7" : p.status === "completada" ? "#F3F4F6" : "#FEF3C7",
                        color: p.status === "en_curso" ? "#10B981" : p.status === "completada" ? "#9CA3AF" : "#D97706",
                        fontWeight: 600,
                      }}
                    >
                      {p.status === "en_curso" ? "En curso" : p.status === "completada" ? "Completada" : "Pendiente"}
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
                  className="w-full flex items-center gap-3.5 px-5 py-4 text-left transition-all"
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
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#FEE2E2", color: "#EF4444", fontWeight: 700 }}
              >
                {notifications.length} nuevas
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
              {notifications.map((n, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: n.dot }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug" style={{ color: "#374151" }}>{n.text}</p>
                    <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
