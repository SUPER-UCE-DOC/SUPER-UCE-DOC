import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  Video, Mic, MicOff, VideoOff, Phone, Send, CheckCircle,
  Calendar, Users, Stethoscope, FileText, Clock, AlertCircle,
  ChevronRight, Plus, Search, Brain, Zap
} from "lucide-react";
import { DoctorHome } from "./DoctorHome";
import { SettingsView } from "./SettingsView";

type View = string;

interface DoctorDashboardProps {
  userName: string;
  currentView: View;
  onNavigate?: (view: string) => void;
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

export function DoctorDashboard({ userName, currentView, onNavigate }: DoctorDashboardProps) {
  const navigate = (v: string) => onNavigate?.(v);
  if (currentView === "home") return <DoctorHome userName={userName} onNavigate={navigate} />;
  if (currentView === "dashboard") return <AgendaView userName={userName} />;
  if (currentView === "schedule") return <AgendaView userName={userName} />;
  if (currentView === "patients") return <PatientsView />;
  if (currentView === "teleconsult") return <TeleconsultaView />;
  if (currentView === "prescriptions") return <RecetasView />;
  if (currentView === "ai-assistant") return <TeleconsultaView />;
  if (currentView === "settings") return <SettingsView role="doctor" userName={userName} />;
  return <DoctorHome userName={userName} onNavigate={navigate} />;
}

/* ─── MI AGENDA ─── */
function AgendaView({ userName }: { userName: string }) {
  const [agenda, setAgenda] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgenda = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      const formatted = data.map((app: any) => ({
        id: app.id,
        patient: app.patient_name,
        time: new Date(app.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: app.type || "Teleconsulta",
        deaf: app.patient_name.includes("Rosa") || app.patient_name.includes("María") || app.patient_name.includes("Morales"),
        status: app.status
      }));
      setAgenda(formatted);
    } catch (err) {
      console.error("Error al cargar la agenda:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const totalHoy = agenda.length;
  const completadas = agenda.filter(item => item.status === "completada").length;
  const pendientes = agenda.filter(item => item.status === "pendiente" || item.status === "en_curso").length;

  const dateStr = new Date().toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <div className="p-6 space-y-6 anim-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Mi Agenda</h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>Dr. {userName} · {dateCapitalized}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Total hoy", value: totalHoy, color: "#203A70" },
            { label: "Completadas", value: completadas, color: "#10B981" },
            { label: "Pendientes", value: pendientes, color: "#D97706" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl px-4 py-3 shadow-sm">
              <div style={{ color: s.color, fontSize: "22px", fontWeight: 800 }}>{s.value}</div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline de citas */}
      <div className="space-y-3 anim-fade-in-up anim-d-1">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando agenda médica...</div>
        ) : agenda.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No hay citas programadas para hoy.</div>
        ) : (
          agenda.map((item, i) => {
            const statusConf = {
              completada: { bg: "#F3F4F6", color: "#9CA3AF", dot: "#10B981", label: "✓ Completada" },
              en_curso: { bg: "#F0FFFE", color: "#00A69D", dot: "#00A69D", label: "● En curso" },
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
                        className="text-xs px-3 py-1 rounded-full"
                        style={{
                          background: item.status === "en_curso" ? "#DCFCE7" : item.status === "completada" ? "#F3F4F6" : "#FEF3C7",
                          color: item.status === "en_curso" ? "#10B981" : item.status === "completada" ? "#9CA3AF" : "#D97706",
                          fontWeight: 600,
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
  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.condition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5 anim-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Mis Pacientes</h1>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm"
          style={{ background: "#00A69D", fontWeight: 700 }}
        >
          <Plus size={16} /> Nuevo Paciente
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente o diagnóstico..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none"
          style={{ borderColor: "#E5E7EB", background: "white" }}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((p, i) => (
          <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm anim-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                  style={{ background: "#203A70", fontWeight: 800, fontSize: "16px" }}
                >
                  {p.avatar}
                </div>
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
                <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Última visita: {p.lastVisit} Jul 2026</div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    background: p.status === "estable" ? "#DCFCE7" : p.status === "critico" ? "#FEE2E2" : "#FEF3C7",
                    color: p.status === "estable" ? "#10B981" : p.status === "critico" ? "#EF4444" : "#D97706",
                    fontWeight: 600,
                  }}
                >
                  {p.status === "estable" ? "✓ Estable" : p.status === "critico" ? "🚨 Crítico" : "⚠ Seguimiento"}
                </span>
                <button className="text-xs px-3 py-2 rounded-xl border" style={{ borderColor: "#00A69D", color: "#00A69D", fontWeight: 600 }}>
                  Ver historial
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const waitingPatients = [
  { name: "Rosa Chávez", time: "11:30", reason: "Seguimiento ansiedad e hipertensión", deaf: true, avatar: "RC", status: "esperando" },
  { name: "Juan Paredes", time: "14:00", reason: "Control glucemia — Diabetes Tipo 2", deaf: false, avatar: "JP", status: "en_espera" },
  { name: "Ana Morales", time: "15:30", reason: "Control prenatal — Semana 28", deaf: true, avatar: "AM", status: "en_espera" },
];

/* ─── TELECONSULTA CON TRADUCTOR IA ─── */
function TeleconsultaView() {
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePatient, setActivePatient] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [rx, setRx] = useState({ medicine: "", dose: "", frequency: "" });
  const [rxSubmitted, setRxSubmitted] = useState(false);

  const selectedPatient = waitingList.find((p) => p.name === activePatient) ?? null;

  const loadWaitingRoom = async () => {
    try {
      setLoading(true);
      const data = await api.getWaitingRoom();
      const formatted = data.map((app: any) => ({
        id: app.id,
        patient_id: app.patient_id,
        name: app.patient_name,
        time: new Date(app.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reason: app.reason || "Teleconsulta de seguimiento",
        deaf: app.patient_name.includes("Rosa") || app.patient_name.includes("María") || app.patient_name.includes("Morales"),
        avatar: app.patient_name.substring(0, 2).toUpperCase(),
        status: app.status
      }));
      setWaitingList(formatted);
    } catch (err) {
      console.error("Error al cargar sala de espera:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaitingRoom();
  }, [inCall]);

  useEffect(() => {
    if (!inCall) return;
    const t1 = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    const t2 = setInterval(() => setVisibleLines((v) => Math.min(v + 1, aiTranslations.length)), 4000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [inCall]);

  const startCall = async (patient: any) => {
    try {
      await api.updateAppointmentStatus(patient.id, "en_curso");
      setActivePatient(patient.name);
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
    if (selectedPatient) {
      try {
        // Generar historial de conversación de prueba para el resumen clínico IA
        const transcript = aiTranslations.map(t => `${t.gesture} -> ${t.translation}`).join("\n");
        await api.summarizeConsultation(selectedPatient.id, transcript);
      } catch (err) {
        console.error("Error guardando resumen clínico:", err);
      }
    }
    setInCall(false);
    setActivePatient(null);
    setElapsedSecs(0);
    setVisibleLines(0);
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

  /* ── Sala de espera ── */
  if (!inCall) return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB", minHeight: "100vh" }}>
      <div className="anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Sala de Espera Virtual</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          Selecciona un paciente para iniciar la videollamada
        </p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando sala de espera...</div>
        ) : waitingList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No hay pacientes esperando consulta.</div>
        ) : (
          waitingList.map((p, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 flex items-center gap-4 shadow-sm anim-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: i === 0 ? "#00A69D" : "#203A70", fontWeight: 800 }}
            >
              {p.avatar}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: "#203A70", fontWeight: 700 }}>{p.name}</span>
                {p.deaf && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
                  >
                    🤟 Paciente Sordo · LSE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#9CA3AF" }}>
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {p.time}
                </span>
                <span>·</span>
                <span>{p.reason}</span>
              </div>
            </div>

            {/* Estado + acción */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {i === 0 && (
                <span
                  className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  En espera
                </span>
              )}
              <button
                onClick={() => startCall(p)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm transition-all"
                style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.25)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
              >
                <Video size={15} /> Iniciar Videollamada
              </button>
            </div>
          </div>
        )))
      }
      </div>
    </div>
  );

  /* ── Vista en llamada ── */
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "22px", fontWeight: 800 }}>Teleconsulta — Vista Médico</h1>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: "#6B7280" }}>Paciente:</span>
            <strong style={{ color: "#203A70" }}>{selectedPatient?.name}</strong>
            {selectedPatient?.deaf && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
            >
              🤟 Paciente Sordo — LSE activo
            </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 700 }}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          EN CONSULTA · {formatTime(elapsedSecs)}
        </div>
      </div>

      {/* Zona principal: Video + Traductor IA */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* VIDEO DEL PACIENTE — ocupa 3/5 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ background: "#0d1a2e", minHeight: "320px" }}
          >
            {/* Video paciente */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a2744, #0d1a2e)" }}>
              <div className="text-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl mx-auto mb-3"
                  style={{ background: "#374151", fontWeight: 800 }}
                >
                  RC
                </div>
                <p className="text-white text-lg" style={{ fontWeight: 600 }}>Rosa Chávez</p>
                <p className="text-blue-300 text-sm">📷 Cámara paciente · Realizando señas LSE</p>
              </div>
            </div>

            {/* Overlay: señas detectadas */}
            {inCall && (
              <div
                className="absolute top-4 left-4 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(0,166,157,0.9)", color: "white", fontWeight: 700 }}
              >
                🤟 {aiTranslations[Math.min(visibleLines - 1, aiTranslations.length - 1)]?.gesture}
              </div>
            )}

            {/* Live badge */}
            <div
              className="absolute top-4 right-4 px-3 py-1 rounded-xl text-xs text-white"
              style={{ background: "#10B981", fontWeight: 700 }}
            >
              ● EN VIVO
            </div>

            {/* Cámara del médico — pequeña en esquina inferior */}
            <div
              className="absolute bottom-4 right-4 rounded-xl overflow-hidden border-2 flex flex-col items-center justify-center"
              style={{ width: "110px", height: "80px", borderColor: "#00A69D", background: "#1e3a5f" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs mb-1" style={{ background: "#203A70", fontWeight: 700 }}>Dr</div>
              <p className="text-white text-xs" style={{ fontWeight: 600 }}>Tú (médico)</p>
            </div>
          </div>

          {/* Controles */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setMuted(!muted)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm"
              style={{
                background: muted ? "#FEE2E2" : "white",
                color: muted ? "#EF4444" : "#203A70",
                fontWeight: 600,
              }}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              {muted ? "Activar mic" : "Silenciar"}
            </button>
            <button
              onClick={endCall}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm"
              style={{ background: "#EF4444", fontWeight: 700 }}
            >
              <Phone size={18} /> Finalizar Consulta
            </button>
          </div>

          {/* FORMULARIO RECETA RÁPIDA — debajo del video */}
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} style={{ color: "#203A70" }} />
              <h3 style={{ color: "#203A70", fontWeight: 700 }}>Receta Digital Rápida</h3>
            </div>

            {rxSubmitted ? (
              <div className="flex flex-col items-center py-4 gap-3">
                <CheckCircle size={40} style={{ color: "#10B981" }} />
                <p style={{ color: "#203A70", fontWeight: 700 }}>Receta emitida y geoLocalizada</p>
                <p className="text-sm text-center" style={{ color: "#6B7280" }}>Enviada a farmacias dentro de 2km del paciente</p>
                <button onClick={() => setRxSubmitted(false)} className="px-4 py-2 rounded-xl text-white text-sm" style={{ background: "#00A69D", fontWeight: 600 }}>
                  Nueva receta
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { key: "medicine", label: "Medicamento", placeholder: "Ej: Losartán 25mg" },
                    { key: "dose", label: "Dosis", placeholder: "Ej: 1 comprimido" },
                    { key: "frequency", label: "Frecuencia", placeholder: "Ej: Cada 24 horas" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs mb-1" style={{ color: "#6B7280", fontWeight: 600 }}>{f.label}</label>
                      <input
                        value={rx[f.key as keyof typeof rx]}
                        onChange={(e) => setRx({ ...rx, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2.5 rounded-xl border outline-none text-sm"
                        style={{ borderColor: "#E5E7EB" }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleEmitRx}
                  className="w-full py-3 rounded-xl text-white flex items-center justify-center gap-2"
                  style={{ background: "#00A69D", fontWeight: 800, fontSize: "15px" }}
                >
                  <Zap size={18} /> Emitir y Geolocalizar Receta
                </button>
              </>
            )}
          </div>
        </div>

        {/* PANEL TRADUCTOR IA — ocupa 2/5 */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="bg-white rounded-2xl shadow-md flex flex-col" style={{ minHeight: "400px" }}>
            {/* Cabecera */}
            <div
              className="flex items-center gap-2 px-5 py-4 border-b rounded-t-2xl"
              style={{ borderColor: "#E5E7EB", background: "#F0FFFE" }}
            >
              <Brain size={20} style={{ color: "#203A70" }} />
              <div>
                <p style={{ color: "#203A70", fontWeight: 700 }}>Traductor de Inteligencia Artificial</p>
                <p className="text-xs" style={{ color: "#00A69D" }}>LSE → Texto · Activo en tiempo real</p>
              </div>
              {inCall && (
                <span
                  className="ml-auto text-xs px-2 py-1 rounded-full animate-pulse"
                  style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}
                >
                  ● Procesando
                </span>
              )}
            </div>

            {/* Stream de traducciones */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {aiTranslations.slice(0, visibleLines).map((line, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3 border"
                  style={{
                    background: i === visibleLines - 1 ? "#F0FFFE" : "#FAFAFA",
                    borderColor: i === visibleLines - 1 ? "#00A69D" : "#F3F4F6",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>{line.time}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "#F0FFFE", color: "#00A69D", fontWeight: 600 }}
                    >
                      🤟 {line.gesture}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#203A70", fontWeight: i === visibleLines - 1 ? 600 : 400 }}>
                    {line.translation}
                  </p>
                </div>
              ))}

              {inCall && visibleLines < aiTranslations.length && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "#F9FAFB" }}>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <div key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#00A69D", animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>Interpretando señas...</span>
                </div>
              )}
            </div>

            {/* Resumen IA */}
            <div className="p-4 border-t rounded-b-2xl" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
              <p className="text-xs mb-1" style={{ color: "#9CA3AF", fontWeight: 600 }}>RESUMEN CLÍNICO IA</p>
              <p className="text-sm" style={{ color: "#374151" }}>
                Paciente refiere <strong>cefalea de 3 días</strong> sin medicación, con <strong>mareos posturales</strong> asociados. Probable descompensación hipertensiva.
              </p>
            </div>
          </div>

          {/* Info del paciente en consulta */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs mb-3" style={{ color: "#9CA3AF", fontWeight: 600 }}>DATOS DEL PACIENTE</p>
            <div className="space-y-2">
              {[
                { label: "Diagnóstico", value: "Ansiedad + HTA leve" },
                { label: "Último PA", value: "145/92 mmHg ⚠" },
                { label: "Medicación", value: "Sertralina 50mg + Enalapril 5mg" },
                { label: "Alergias", value: "Ninguna conocida" },
              ].map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span style={{ color: "#9CA3AF" }}>{d.label}</span>
                  <span style={{ color: "#203A70", fontWeight: 600 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── RECETAS ─── */
function RecetasView() {
  const [form, setForm] = useState({ patient: "", medicine: "", dose: "", frequency: "" });
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="p-6 space-y-6 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Emitir Receta Digital</h1>

      {submitted ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center anim-scale-in">
          <CheckCircle size={56} style={{ color: "#10B981", margin: "0 auto 16px" }} />
          <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "20px" }}>Receta Emitida y Geolocalizadal</h2>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
            La receta fue enviada al paciente y notificada a farmacias en un radio de 2km.
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm({ patient: "", medicine: "", dose: "", frequency: "" }); }}
            className="mt-6 px-8 py-3 rounded-xl text-white"
            style={{ background: "#00A69D", fontWeight: 700 }}
          >
            Nueva Receta
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm max-w-2xl anim-fade-in-up anim-d-1">
          <div className="space-y-4">
            {[
              { key: "patient", label: "Paciente", placeholder: "Nombre del paciente" },
              { key: "medicine", label: "Medicamento", placeholder: "Ej: Atorvastatina 20mg" },
              { key: "dose", label: "Dosis", placeholder: "Ej: 1 comprimido" },
              { key: "frequency", label: "Frecuencia", placeholder: "Ej: Cada 24 horas por 30 días" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => { if (form.medicine) setSubmitted(true); }}
            className="w-full mt-6 py-4 rounded-xl text-white flex items-center justify-center gap-2"
            style={{ background: "#00A69D", fontWeight: 800, fontSize: "16px" }}
          >
            <Zap size={20} /> Emitir y Geolocalizar Receta
          </button>
        </div>
      )}
    </div>
  );
}
