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
    <div className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-cyan-500/30 text-cyan-200 font-bold border border-cyan-400/50">
      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
      ● En Curso · {m}:{s}
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
        time: formatDateSafe(apt.date_time)
      });
    } else if (apt.status === "confirmada" || apt.status === "en_curso") {
      recentActivities.push({
        id: `apt_${apt.id}`,
        icon: <Calendar size={15} style={{ color: "#203A70" }} />,
        title: apt.status === "en_curso" ? "Consulta en curso" : "Cita confirmada",
        desc: `Teleconsulta con ${apt.doctor_name || "Doctor"}`,
        time: formatDateSafe(apt.date_time)
      });
    }
  });

  prescriptionsList.forEach(rx => {
    recentActivities.push({
      id: `rx_${rx.id}`,
      icon: <Pill size={15} style={{ color: "#D97706" }} />,
      title: "Receta emitida",
      desc: `${rx.medicine} (${rx.dose || "Dosis prescrita"})`,
      time: formatDateSafe(rx.created_at)
    });
  });

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
          <span
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-4"
            style={{ background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600 }}
          >
            <Clock size={11} /> Tu próxima cita médica
          </span>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-white flex items-center gap-2 flex-wrap" style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1.3 }}>
                <span>{nextApp ? (nextApp.doctor_name || "Doctor Especialista") : "No tienes citas agendadas"}</span>
                {nextApp && (nextApp.doctor_specialty || nextApp.specialty) && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-300/30 font-semibold">
                    {nextApp.doctor_specialty || nextApp.specialty}
                  </span>
                )}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px", marginTop: "2px" }}>
                {nextApp ? `${nextApp.type || "Teleconsulta"} · ${nextApp.reason || "Consulta General"}` : "Solicita una teleconsulta médica cuando lo necesites"}
              </p>
              {nextApp && (
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} style={{ color: "#00C7C0" }} />
                    <span className="text-white text-sm" style={{ fontWeight: 600 }}>{formatDateSafe(nextApp.date_time)}</span>
                  </div>

                  {nextApp.status === "en_curso" ? (
                    <LiveHomeBadge roomCode={nextApp.id} />
                  ) : (
                    <div
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      style={{
                        background: nextApp.status === "confirmada" ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
                        color: nextApp.status === "confirmada" ? "#6EE7B7" : "#FDE68A",
                        fontWeight: 600
                      }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${nextApp.status === "confirmada" ? "bg-green-400" : "bg-amber-400"}`} />
                      {nextApp.status === "confirmada" ? "✓ Confirmada" : "⏳ Pendiente"}
                    </div>
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
              <button
                onClick={() => alert("El médico debe presionar 'Iniciar Videollamada' en su panel. En cuanto la inicie, este botón se activará automáticamente.")}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm whitespace-nowrap transition-all bg-white/20 text-white font-bold opacity-90 cursor-pointer"
              >
                <Clock size={18} />
                Esperando al Médico
              </button>
            ) : (
              <button
                onClick={() => onNavigate("appointments")}
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
            onClick={() => onNavigate("appointments")}
            className="bg-white rounded-2xl p-5 text-left shadow-sm group transition-all cursor-pointer"
            style={{ border: "1px solid #F3F4F6" }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EEF2FF" }}>
              <Calendar size={24} style={{ color: "#203A70" }} />
            </div>
            <p style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>Agendar Cita Médica</p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Ver disponibilidad de especialistas</p>
            <div className="flex items-center gap-1 mt-4 text-xs" style={{ color: "#00A69D", fontWeight: 600 }}>
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
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Resuelve dudas sobre tu salud 24/7</p>
            <div className="flex items-center gap-1 mt-4 text-xs" style={{ color: "#00A69D", fontWeight: 600 }}>
              Abrir chat <ChevronRight size={13} />
            </div>
          </button>

          {/* Mis recetas */}
          <button
            onClick={() => onNavigate("prescriptions")}
            className="bg-white rounded-2xl p-5 text-left shadow-sm transition-all relative cursor-pointer"
            style={{ border: "1px solid #F3F4F6" }}
          >
            {prescriptionsList.length > 0 && (
              <span
                className="absolute top-4 right-4 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 700 }}
              >
                {prescriptionsList.length} {prescriptionsList.length === 1 ? "Activa" : "Activas"}
              </span>
            )}

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF3C7" }}>
              <Pill size={24} style={{ color: "#D97706" }} />
            </div>
            <p style={{ color: "#203A70", fontWeight: 700, fontSize: "15px" }}>Mis Recetas Activas</p>
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Ver y localizar farmacias cercanas</p>
            <div className="flex items-center gap-1 mt-4 text-xs" style={{ color: "#00A69D", fontWeight: 600 }}>
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
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{item.desc}</p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "#9CA3AF" }}>{item.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center" style={{ border: "1px solid #F3F4F6" }}>
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-600">Sin actividad reciente registrada</p>
            <p className="text-xs text-gray-400 mt-1">Tus consultas finalizadas y recetas emitidas aparecerán automáticamente en esta sección.</p>
          </div>
        )}
      </div>

    </div>
  );
}
