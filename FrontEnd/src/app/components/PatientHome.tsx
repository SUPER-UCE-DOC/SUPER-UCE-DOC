import { Video, Calendar, MessageSquareHeart, Pill, ChevronRight, Clock, Activity } from "lucide-react";

interface PatientHomeProps {
  userName: string;
  onNavigate: (view: string) => void;
}

export function PatientHome({ userName, onNavigate }: PatientHomeProps) {
  const firstName = userName.split(" ")[0];

  return (
    <div className="p-6 space-y-6 anim-fade-in" style={{ background: "#F9FAFB", minHeight: "100vh" }}>

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
              <h2 className="text-white" style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1.3 }}>
                Dr. Carlos Mendoza
              </h2>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px", marginTop: "2px" }}>
                Cardiología · Teleconsulta
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} style={{ color: "#00C7C0" }} />
                  <span className="text-white text-sm" style={{ fontWeight: 600 }}>Hoy, 15:30</span>
                </div>
                <div
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(16,185,129,0.25)", color: "#6EE7B7", fontWeight: 600 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Confirmada
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate("teleconsult")}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm whitespace-nowrap transition-all"
              style={{
                background: "#00A69D",
                color: "white",
                fontWeight: 800,
                fontSize: "15px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
            >
              <Video size={18} />
              Entrar a la Sala de Telemedicina
            </button>
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
            className="bg-white rounded-2xl p-5 text-left shadow-sm group transition-all anim-fade-in-up"
            style={{ border: "1px solid #F3F4F6", animationDelay: "120ms" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(32,58,112,0.10)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
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
            className="bg-white rounded-2xl p-5 text-left shadow-sm transition-all anim-fade-in-up"
            style={{ border: "1px solid #F3F4F6", animationDelay: "200ms" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(32,58,112,0.10)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
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
            className="bg-white rounded-2xl p-5 text-left shadow-sm transition-all relative anim-fade-in-up"
            style={{ border: "1px solid #F3F4F6", animationDelay: "280ms" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(32,58,112,0.10)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
          >
            {/* Badge */}
            <span
              className="absolute top-4 right-4 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#FEE2E2", color: "#EF4444", fontWeight: 700 }}
            >
              2 Pendientes
            </span>

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
        <div className="bg-white rounded-2xl shadow-sm divide-y" style={{ border: "1px solid #F3F4F6", borderColor: "#F3F4F6" }}>
          {[
            { icon: <Activity size={15} style={{ color: "#00A69D" }} />, title: "Consulta completada", desc: "Teleconsulta con Dra. Ana Torres · Neurología", time: "Hace 2 días", dot: "#00A69D" },
            { icon: <Pill size={15} style={{ color: "#D97706" }} />, title: "Receta emitida", desc: "Atorvastatina 20mg — Dr. Carlos Mendoza", time: "Hace 3 días", dot: "#D97706" },
            { icon: <Calendar size={15} style={{ color: "#203A70" }} />, title: "Cita confirmada", desc: "Cardiología · Hoy 15:30 — Dr. Carlos Mendoza", time: "Ayer", dot: "#203A70" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
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
      </div>

    </div>
  );
}
