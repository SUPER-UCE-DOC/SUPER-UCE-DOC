import { useState, useEffect } from "react";
import {
  Video, Mic, MicOff, VideoOff, Phone, MapPin, Pill,
  Hand, Captions, Volume2, Sparkles
} from "lucide-react";
import { FarmaciasMapaView } from "./FarmaciasMapaView";
import { PatientHome } from "./PatientHome";
import { SettingsView } from "./SettingsView";

type View = string;

interface PatientDashboardProps {
  userName: string;
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

export function PatientDashboard({ userName, currentView, onNavigate }: PatientDashboardProps) {
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
  if (currentView === "ai-assistant") return <AsistenteView />;
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
  return (
    <div className="p-6 space-y-5 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>Mis Recetas</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 anim-fade-in-up anim-d-1">
        {prescriptions.map((rx, rxIdx) => (
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
        ))}
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
const suggestions = [
  { icon: "💊", text: "Explicar mi última receta médica", desc: "Entiende cada medicamento prescrito" },
  { icon: "🩸", text: "¿Cómo prepararme para un análisis de sangre?", desc: "Ayuno, hidratación y más" },
  { icon: "❓", text: "Tengo dudas sobre un medicamento", desc: "Efectos, dosis e interacciones" },
  { icon: "🫀", text: "¿Qué síntomas debo vigilar?", desc: "Señales de alerta por condición" },
];

const botReplies = [
  "Entiendo tu consulta. Basándome en información médica general, te recomiendo consultar con tu médico para una evaluación personalizada. ¿Deseas que te explique algo en más detalle?",
  "Esa es una excelente pregunta. Los medicamentos deben tomarse siempre según la indicación de tu médico. Puedo darte información general, pero recuerda que cada caso es único. ¿Hay algo específico que quieras saber?",
  "Para prepararte correctamente, generalmente se recomienda ayunar entre 8 y 12 horas antes. Puedes beber agua con moderación. ¿Quieres más detalles sobre el procedimiento?",
];

function AsistenteView() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ from: string; text: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const msgsEndRef = { current: null as HTMLDivElement | null };

  const send = (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;
    setInput("");
    setMsgs((p) => [...p, { from: "user", text: query }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: botReplies[p.length % botReplies.length] }]);
    }, 1100);
  };

  const isEmpty = msgs.length === 0;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 66px)", background: "#F9FAFB" }}
    >
      {/* ── Estado vacío: saludo + input centrado ── */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 anim-fade-in">

          {/* Icono decorativo */}

          {/* Saludo */}
          <h1
            className="text-center mb-2 anim-fade-in-up anim-d-0"
            style={{
              fontSize: "clamp(22px, 4vw, 32px)",
              fontWeight: 800,
              lineHeight: 1.25,
              background: "linear-gradient(135deg, #203A70 30%, #00A69D 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Hola. ¿En qué te puedo ayudar<br />con tu salud hoy?
          </h1>
          <p className="text-sm mb-8" style={{ color: "#9CA3AF" }}>
            MediBot · Asistente de salud con IA · Disponible 24/7
          </p>

          {/* Input bar */}
          <div className="w-full anim-fade-in-up anim-d-1" style={{ maxWidth: "780px" }}>
            <div
              className="flex items-center gap-3 bg-white px-5 py-4 rounded-3xl"
              style={{ boxShadow: "0 8px 32px rgba(32,58,112,0.10), 0 1px 4px rgba(0,0,0,0.06)" }}
            >
              <Mic size={20} style={{ color: "#9CA3AF", flexShrink: 0 }} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escribe tu consulta médica aquí..."
                className="flex-1 outline-none bg-transparent"
                style={{ color: "#203A70", fontSize: "16px" }}
                autoFocus
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm transition-all"
                style={{
                  background: input.trim() ? "#00A69D" : "#E5E7EB",
                  color: input.trim() ? "white" : "#9CA3AF",
                  fontWeight: 700,
                  boxShadow: input.trim() ? "0 2px 10px rgba(0,166,157,0.3)" : "none",
                }}
              >
                <Sparkles size={15} />
                Enviar
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 w-full" style={{ maxWidth: "780px" }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s.text)}
                className="bg-white rounded-2xl p-4 text-left transition-all anim-fade-in-up"
                style={{
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                  border: "1px solid #F3F4F6",
                  animationDelay: `${60 + i * 60}ms`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#00C7C0";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,199,192,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#F3F4F6";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)";
                }}
              >
                <span className="text-xl block mb-2">{s.icon}</span>
                <p className="text-xs leading-snug" style={{ color: "#203A70", fontWeight: 600 }}>{s.text}</p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

      ) : (
        /* ── Estado con conversación ── */
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5" style={{ maxWidth: "860px", width: "100%", margin: "0 auto" }}>
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.from === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                  style={{ background: m.from === "bot" ? "linear-gradient(135deg,#203A70,#00A69D)" : "#00A69D", color: "white" }}
                >
                  {m.from === "bot" ? "🤖" : "👤"}
                </div>
                <div
                  className="max-w-lg px-5 py-3.5 rounded-2xl text-sm"
                  style={{
                    background: m.from === "bot" ? "white" : "#203A70",
                    color: m.from === "bot" ? "#374151" : "white",
                    boxShadow: m.from === "bot" ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
                    lineHeight: 1.6,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#203A70,#00A69D)" }}>
                  🤖
                </div>
                <div className="px-5 py-4 rounded-2xl bg-white flex items-center gap-1.5" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-2 h-2 rounded-full animate-bounce inline-block"
                      style={{ background: "#00A69D", animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={(el) => { msgsEndRef.current = el; }} />
          </div>

          {/* Input bar fixed at bottom */}
          <div className="px-6 py-4 border-t" style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
            <div
              className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-3xl mx-auto"
              style={{ maxWidth: "860px", boxShadow: "0 4px 20px rgba(32,58,112,0.08), 0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <Mic size={18} style={{ color: "#9CA3AF", flexShrink: 0 }} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escribe tu siguiente consulta..."
                className="flex-1 outline-none bg-transparent text-sm"
                style={{ color: "#203A70" }}
                autoFocus
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-white text-sm transition-all"
                style={{
                  background: input.trim() ? "#00A69D" : "#E5E7EB",
                  color: input.trim() ? "white" : "#9CA3AF",
                  fontWeight: 700,
                }}
              >
                <Sparkles size={14} />
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
