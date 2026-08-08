import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../utils/api";
import {
  User, Bell, Eye, Clock, Stethoscope,
  Building2, Truck, MapPin, X, Image as ImageIcon, Trash2
} from "lucide-react";

type Role = "patient" | "doctor" | "pharmacy";

interface SettingsViewProps {
  role: Role;
  userName: string;
  userName: string;
}

/* ── Profile Image Upload ───────────────────────────────── */
function ProfileImageUpload({ userName }: { userName: string }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isClosingPreview, setIsClosingPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getMe().then(u => setAvatar(u.avatar || null));
  }, []);

  const handleProcessFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setAvatar(base64);
      try {
        await api.updateAvatar(base64);
        window.dispatchEvent(new Event("avatarUpdated"));
        setIsModalOpen(false);
      } catch (err) {
        console.error("Error updating avatar", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClosePreview = () => {
    setIsClosingPreview(true);
    setTimeout(() => {
      setIsPreviewOpen(false);
      setIsClosingPreview(false);
    }, 250);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleProcessFile(file);
    }
  };

  const handleDelete = async () => {
    setAvatar(null);
    try {
      await api.updateAvatar("");
      window.dispatchEvent(new Event("avatarUpdated"));
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error deleting avatar", err);
    }
  };

  return (
    <div className="flex items-center gap-4 py-4 mb-4">
      <div
        onClick={() => avatar && setIsPreviewOpen(true)}
        className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 flex items-center justify-center text-2xl font-bold ${avatar ? 'cursor-default hover:opacity-80 transition-opacity' : ''}`}
        style={{ borderColor: "#E5E7EB", background: avatar ? "white" : "#00A69D", color: "white" }}
      >
        {avatar ? (
          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          (() => {
            const parts = userName.trim().split(/\s+/);
            return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
          })()
        )}
      </div>
      <div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-white border rounded-lg text-sm font-semibold transition-colors hover:bg-gray-50"
          style={{ borderColor: "#E5E7EB", color: "#203A70" }}
        >
          Cambiar foto de perfil
        </button>
        <p className="text-xs text-gray-500 mt-1">Administra tu foto actual</p>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm anim-fade-in" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-white w-[85%] sm:w-full max-w-[340px] sm:max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl anim-scale-in"
            style={{ border: "1px solid #E5E7EB" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>Foto de perfil</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all"
              style={{
                borderColor: isDragging ? "#00A69D" : "#D1D5DB",
                background: isDragging ? "#F0FFFE" : "#F9FAFB"
              }}
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-3" style={{ color: "#00A69D" }}>
                <ImageIcon size={24} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Arrastra tu imagen aquí</p>
              <p className="text-xs text-gray-500 mb-4">o selecciona un archivo desde tu equipo</p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "#00A69D", boxShadow: "0 2px 10px rgba(0,166,157,0.3)" }}
              >
                Buscar archivo
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            {avatar && (
              <div className="mt-6 pt-6 border-t flex justify-between items-center" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-3">
                  <img src={avatar} alt="Current" className="w-10 h-10 rounded-xl object-cover border" style={{ borderColor: "#E5E7EB", background: "white" }} />
                  <span className="text-sm font-medium text-gray-700">Foto actual</span>
                </div>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)" }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {isPreviewOpen && avatar && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm ${isClosingPreview ? 'anim-fade-out' : 'anim-fade-in'}`}
          onClick={handleClosePreview}
        >
          <img
            src={avatar}
            alt="Avatar Preview"
            className={`max-w-[90vw] max-h-[90vh] object-contain rounded-2xl ${isClosingPreview ? 'anim-scale-out' : 'anim-scale-in'}`}
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)", background: "white" }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Shared primitives ──────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        background: checked ? "#00A69D" : "#D1D5DB",
        border: "none",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "22px" : "2px",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function FieldInput({
  label, value, onChange, placeholder, type = "text", disabled = false, badge,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; badge?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{label}</label>
        {badge && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            {badge}
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm transition-all ${
          disabled ? "bg-gray-50/80 text-gray-500 cursor-not-allowed border-gray-200 font-medium" : "bg-white text-gray-800"
        }`}
        style={{ borderColor: "#E5E7EB" }}
        onFocus={(e) => !disabled && (e.target.style.borderColor = "#00A69D")}
        onBlur={(e) => !disabled && (e.target.style.borderColor = "#E5E7EB")}
      />
    </div>
  );
}

function SegmentedControl({
  label, desc, options, value, onChange,
}: {
  label: string; desc?: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{desc}</p>}
      </div>
      <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #E5E7EB" }}>
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-3 py-1.5 text-xs transition-all"
            style={{
              background: value === opt ? "#00A69D" : "white",
              color: value === opt ? "white" : "#6B7280",
              fontWeight: value === opt ? 700 : 400,
              borderRight: i < options.length - 1 ? "1px solid #E5E7EB" : "none",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({
  title, icon, children, delay = 0,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; delay?: number;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden anim-fade-in-up"
      style={{ border: "1px solid #F3F4F6", animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "#F3F4F6" }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "#F0FFFE" }}
        >
          <span style={{ color: "#00A69D" }}>{icon}</span>
        </div>
        <h2
          className="text-sm"
          style={{ color: "#203A70", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {title}
        </h2>
      </div>
      <div className="px-6 divide-y" style={{ borderColor: "#F3F4F6" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Patient ────────────────────────────────────────────── */
/* ── Patient ────────────────────────────────────────────── */
function PatientSettings({ userName }: { userName: string }) {
  const [altoContraste, setAltoContraste] = useState(false);
  const [lse, setLse] = useState(true);
  const [videoSubtitlesOverlay, setVideoSubtitlesOverlay] = useState(true);
  const [subtitleSize, setSubtitleSize] = useState("Mediano");
  const [nombre, setNombre] = useState(userName);
  const [email, setEmail] = useState("");
  const [smsCitas, setSmsCitas] = useState(true);
  const [emailCitas, setEmailCitas] = useState(true);
  const [emailRecetas, setEmailRecetas] = useState(false);

  useEffect(() => {
    // 1. Cargar datos del usuario real desde la API
    api.getMe().then(user => {
      if (user.full_name) setNombre(user.full_name);
      if (user.email) setEmail(user.email);
    }).catch(err => console.error("Error cargando perfil del paciente:", err));

    // 2. Cargar preferencias de Accesibilidad desde localStorage (Por defecto activadas en true para cuentas de pacientes)
    if (localStorage.getItem("lsa_preference") === null) {
      localStorage.setItem("lsa_preference", "true");
    }
    if (localStorage.getItem("settings_video_subtitles_enabled") === null) {
      localStorage.setItem("settings_video_subtitles_enabled", "true");
    }

    const savedAltoContraste = localStorage.getItem("settings_alto_contraste") === "true";
    const savedSubtitleSize = localStorage.getItem("subtitle_size") || "Mediano";
    const savedLse = localStorage.getItem("lsa_preference") !== "false";
    const savedVideoSubtitlesOverlay = localStorage.getItem("settings_video_subtitles_enabled") !== "false";

    setAltoContraste(savedAltoContraste);
    setSubtitleSize(savedSubtitleSize);
    setLse(savedLse);
    setVideoSubtitlesOverlay(savedVideoSubtitlesOverlay);

    if (savedAltoContraste) {
      document.body.classList.add("high-contrast-mode");
    }

    // 3. Cargar preferencias de Notificaciones desde localStorage
    setSmsCitas(localStorage.getItem("settings_sms_citas") !== "false");
    setEmailCitas(localStorage.getItem("settings_email_citas") !== "false");
    setEmailRecetas(localStorage.getItem("settings_email_recetas") === "true");
  }, []);

  const handleAltoContrasteChange = (val: boolean) => {
    setAltoContraste(val);
    localStorage.setItem("settings_alto_contraste", String(val));
    if (val) {
      document.body.classList.add("high-contrast-mode");
    } else {
      document.body.classList.remove("high-contrast-mode");
    }
  };

  const handleVideoSubtitlesOverlayChange = (val: boolean) => {
    setVideoSubtitlesOverlay(val);
    localStorage.setItem("settings_video_subtitles_enabled", String(val));
    window.dispatchEvent(new Event("videoSubtitlesPreferenceChanged"));
  };

  const handleSubtitleSizeChange = (val: string) => {
    setSubtitleSize(val);
    localStorage.setItem("subtitle_size", val);
    window.dispatchEvent(new Event("subtitleSizeChanged"));
  };

  const handleLseChange = (val: boolean) => {
    setLse(val);
    localStorage.setItem("lsa_preference", String(val));
    window.dispatchEvent(new Event("lsaPreferenceChanged"));
  };

  const handleEmailCitasChange = (val: boolean) => {
    setEmailCitas(val);
    localStorage.setItem("settings_email_citas", String(val));
  };

  const handleEmailRecetasChange = (val: boolean) => {
    setEmailRecetas(val);
    localStorage.setItem("settings_email_recetas", String(val));
  };

  return (
    <>
      <Card title="Cuenta y Datos Personales" icon={<User size={16} />} delay={60}>
        <div className="py-4 space-y-4">
          <ProfileImageUpload userName={nombre || userName} />
          <FieldInput
            label="Nombre Completo"
            value={nombre || userName}
            onChange={setNombre}
            disabled={true}
            placeholder="Tu nombre completo"
          />
          <FieldInput
            label="Correo Electrónico"
            value={email}
            onChange={setEmail}
            disabled={true}
            placeholder="correo@ejemplo.com"
            type="email"
          />
        </div>
      </Card>

      <Card title="Accesibilidad" icon={<Eye size={16} />} delay={120}>
        <ToggleRow
          label="Alto Contraste"
          desc="Aumenta el contraste de colores para mayor legibilidad"
          checked={altoContraste}
          onChange={handleAltoContrasteChange}
        />
        <ToggleRow
          label="Subtítulos en Pantalla de Video"
          desc="Muestra la barra de subtítulos en tiempo real sobre la cámara durante la teleconsulta"
          checked={videoSubtitlesOverlay}
          onChange={handleVideoSubtitlesOverlayChange}
        />
        <SegmentedControl
          label="Tamaño de Subtítulos"
          desc="Tamaño del texto en subtítulos de teleconsulta"
          options={["Pequeño", "Mediano", "Grande"]}
          value={subtitleSize}
          onChange={handleSubtitleSizeChange}
        />
        <ToggleRow
          label="Preferencia de Lenguaje de Señas (LSA)"
          desc="Activa el módulo LSA automáticamente en todas las teleconsultas"
          checked={lse}
          onChange={handleLseChange}
        />
      </Card>

      <Card title="Notificaciones" icon={<Bell size={16} />} delay={180}>
        <ToggleRow
          label="Email al confirmar o cancelar una cita"
          desc="Recibe un correo cuando el estado de tu cita cambie"
          checked={emailCitas}
          onChange={handleEmailCitasChange}
        />
        <ToggleRow
          label="Email al emitir una receta"
          desc="Notificación cuando tu médico genere una nueva receta"
          checked={emailRecetas}
          onChange={handleEmailRecetasChange}
        />
      </Card>
    </>
  );
}

/* ── Doctor ─────────────────────────────────────────────── */
function DoctorSettings({ userName }: { userName: string }) {
  const [nombre, setNombre] = useState(userName);
  const [especialidad, setEspecialidad] = useState("Cardiología");
  const [exequatur, setExequatur] = useState("EX-2019-00487");
  const [firma, setFirma] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("17:00");
  const [altoContraste, setAltoContraste] = useState(false);
  const [videoSubtitlesOverlay, setVideoSubtitlesOverlay] = useState(true);
  const [subtitleSize, setSubtitleSize] = useState("Mediano");
  const [days, setDays] = useState<Record<string, boolean>>({
    L: true, M: true, X: true, J: true, V: true, S: false, D: false,
  });
  const dayNames: Record<string, string> = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };

  useEffect(() => {
    // 1. Cargar perfil del doctor desde la API
    api.getMe().then(user => {
      if (user.full_name) setNombre(user.full_name);
      const spec = user.specialty || user.profile?.specialty;
      if (spec) setEspecialidad(spec);
      const exeq = user.exequatur || user.profile?.exequatur;
      if (exeq) setExequatur(exeq);
      if (user.profile) {
        if (user.profile.firma) setFirma(user.profile.firma);
        if (user.profile.start_time) setHoraInicio(user.profile.start_time);
        if (user.profile.end_time) setHoraFin(user.profile.end_time);
        if (user.profile.available_days) {
          const loadedDays = user.profile.available_days.split(",");
          const newDaysState = { ...days };
          Object.keys(newDaysState).forEach(key => {
            newDaysState[key] = loadedDays.includes(key);
          });
          setDays(newDaysState);
        }
      }
    }).catch(err => console.error("Error cargando configuración del doctor:", err));

    // 2. Cargar preferencias de Accesibilidad desde localStorage
    if (localStorage.getItem("settings_video_subtitles_enabled") === null) {
      localStorage.setItem("settings_video_subtitles_enabled", "true");
    }

    const savedAltoContraste = localStorage.getItem("settings_alto_contraste") === "true";
    const savedSubtitleSize = localStorage.getItem("subtitle_size") || "Mediano";
    const savedVideoSubtitlesOverlay = localStorage.getItem("settings_video_subtitles_enabled") !== "false";

    setAltoContraste(savedAltoContraste);
    setSubtitleSize(savedSubtitleSize);
    setVideoSubtitlesOverlay(savedVideoSubtitlesOverlay);

    if (savedAltoContraste) {
      document.body.classList.add("high-contrast-mode");
    }
  }, []);

  // Función helper de autoguardado de configuración de consultorio en backend
  const autoSaveSettings = (newDays: Record<string, boolean>, start: string, end: string, firmaTxt: string) => {
    const activeDays = Object.keys(newDays).filter(k => newDays[k]).join(",");
    api.updateSettings({
      available_days: activeDays,
      start_time: start,
      end_time: end,
      firma: firmaTxt
    }).catch(err => console.error("Error al autoguardar configuración del doctor:", err));
  };

  const handleAltoContrasteChange = (val: boolean) => {
    setAltoContraste(val);
    localStorage.setItem("settings_alto_contraste", String(val));
    if (val) {
      document.body.classList.add("high-contrast-mode");
    } else {
      document.body.classList.remove("high-contrast-mode");
    }
  };

  const handleVideoSubtitlesOverlayChange = (val: boolean) => {
    setVideoSubtitlesOverlay(val);
    localStorage.setItem("settings_video_subtitles_enabled", String(val));
    window.dispatchEvent(new Event("videoSubtitlesPreferenceChanged"));
  };

  const handleSubtitleSizeChange = (val: string) => {
    setSubtitleSize(val);
    localStorage.setItem("subtitle_size", val);
    window.dispatchEvent(new Event("subtitleSizeChanged"));
  };

  const toggleDay = (key: string) => {
    setDays((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      autoSaveSettings(updated, horaInicio, horaFin, firma);
      return updated;
    });
  };

  const handleHoraInicioChange = (val: string) => {
    setHoraInicio(val);
    autoSaveSettings(days, val, horaFin, firma);
  };

  const handleHoraFinChange = (val: string) => {
    setHoraFin(val);
    autoSaveSettings(days, horaInicio, val, firma);
  };

  const handleFirmaChange = (val: string) => {
    setFirma(val);
  };

  const handleFirmaBlur = () => {
    autoSaveSettings(days, horaInicio, horaFin, firma);
  };

  return (
    <>
      <Card title="Perfil Profesional" icon={<Stethoscope size={16} />} delay={60}>
        <div className="py-4 space-y-4">
          <ProfileImageUpload userName={nombre || userName} />
          <FieldInput
            label="Nombre"
            value={nombre || userName}
            onChange={setNombre}
            disabled={true}
            placeholder="Dr. Nombre Apellido"
          />
          <FieldInput
            label="Especialidad Médica"
            value={especialidad}
            onChange={setEspecialidad}
            disabled={true}
            placeholder="Ej: Cardiología"
          />
          <FieldInput
            label="N.º de Exequátur / Licencia"
            value={exequatur}
            onChange={setExequatur}
            disabled={true}
            placeholder="EX-YYYY-00000"
          />
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>
              Firma Digital
              <span className="ml-2 text-xs" style={{ color: "#9CA3AF", fontWeight: 400 }}>
                (texto o iniciales)
              </span>
            </label>
            <textarea
              value={firma}
              onChange={(e) => handleFirmaChange(e.target.value)}
              placeholder="Dr. García · Cardiología · EX-2019-00487"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border outline-none resize-none text-sm transition-all bg-white text-gray-800"
              style={{ borderColor: "#E5E7EB", fontFamily: "Georgia, serif" }}
              onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                handleFirmaBlur();
              }}
            />
          </div>
        </div>
      </Card>

      <Card title="Accesibilidad" icon={<Eye size={16} />} delay={120}>
        <ToggleRow
          label="Alto Contraste"
          desc="Aumenta el contraste de colores para mayor legibilidad"
          checked={altoContraste}
          onChange={handleAltoContrasteChange}
        />
        <ToggleRow
          label="Subtítulos en Pantalla de Video"
          desc="Muestra la barra de subtítulos en tiempo real sobre la cámara durante la teleconsulta"
          checked={videoSubtitlesOverlay}
          onChange={handleVideoSubtitlesOverlayChange}
        />
        <SegmentedControl
          label="Tamaño de Subtítulos"
          desc="Tamaño del texto en subtítulos de teleconsulta"
          options={["Pequeño", "Mediano", "Grande"]}
          value={subtitleSize}
          onChange={handleSubtitleSizeChange}
        />
      </Card>

      <Card title="Consultorio Virtual" icon={<Clock size={16} />} delay={180}>
        <div className="py-4 space-y-5">
          {/* Days picker */}
          <div>
            <p className="text-sm mb-3" style={{ color: "#203A70", fontWeight: 600 }}>
              Días de disponibilidad
            </p>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(days).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  title={dayNames[key]}
                  className="w-10 h-10 rounded-xl text-sm transition-all cursor-pointer"
                  style={{
                    background: days[key] ? "#00A69D" : "#F3F4F6",
                    color: days[key] ? "white" : "#6B7280",
                    fontWeight: days[key] ? 700 : 500,
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Hora de inicio</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => handleHoraInicioChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm bg-white text-gray-800"
                style={{ borderColor: "#E5E7EB" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Hora de cierre</label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => handleHoraFinChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border outline-none text-sm bg-white text-gray-800"
                style={{ borderColor: "#E5E7EB" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

/* ── Pharmacy ───────────────────────────────────────────── */
function PharmacySettings({ userName }: { userName: string }) {
  const [nombre, setNombre] = useState(userName);
  const [direccion, setDireccion] = useState("C/ Sánchez #12, Sector El Café, San Pedro de Macorís");
  const [horaApertura, setHoraApertura] = useState("07:30");
  const [horaCierre, setHoraCierre] = useState("23:00");
  const [radio, setRadio] = useState(5);
  const [alertaSonido, setAlertaSonido] = useState(true);
  const [alertaEmail, setAlertaEmail] = useState(false);
  const [syncAuto, setSyncAuto] = useState(true);
  const [syncFrecuencia, setSyncFrecuencia] = useState("Cada hora");
  const [notifBajoStock, setNotifBajoStock] = useState(true);

  return (
    <>
      <Card title="Datos del Establecimiento" icon={<Building2 size={16} />} delay={60}>
        <div className="py-4 space-y-4">
          <ProfileImageUpload userName={userName} />
          <FieldInput label="Nombre de la Farmacia" value={userName} onChange={() => { }} placeholder="Farmacia XYZ" />

          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>
              Dirección Física
            </label>
            <textarea
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border outline-none resize-none text-sm transition-all"
              style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
              onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Apertura</label>
              <input
                type="time"
                value={horaApertura}
                onChange={(e) => setHoraApertura(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm"
                style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Cierre</label>
              <input
                type="time"
                value={horaCierre}
                onChange={(e) => setHoraCierre(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm"
                style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
          </div>

          {/* Delivery radius */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>Radio de entrega</label>
              <span
                className="text-sm px-3 py-1 rounded-full"
                style={{ background: "#F0FFFE", color: "#00A69D", fontWeight: 700 }}
              >
                {radio} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={radio}
              onChange={(e) => setRadio(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-default"
              style={{ accentColor: "#00A69D" }}
            />
            <div className="flex justify-between text-xs mt-1.5" style={{ color: "#9CA3AF" }}>
              <span>1 km</span>
              <span>10 km</span>
              <span>20 km</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Operaciones" icon={<Truck size={16} />} delay={120}>
        <ToggleRow
          label="Alertas de Recetas Urgentes con Sonido"
          desc="Reproduce una alerta sonora al recibir una receta marcada como urgente"
          checked={alertaSonido}
          onChange={setAlertaSonido}
        />
        <ToggleRow
          label="Notificación por email de recetas urgentes"
          desc="Envía un correo adicional al recibir una receta de alta prioridad"
          checked={alertaEmail}
          onChange={setAlertaEmail}
        />
        <SegmentedControl
          label="Frecuencia de sincronización"
          desc="Con qué frecuencia se actualiza el inventario en el sistema central"
          options={["Manual", "Cada hora", "Automático"]}
          value={syncFrecuencia}
          onChange={setSyncFrecuencia}
        />
        <ToggleRow
          label="Sincronización automática de inventario"
          desc="Actualiza el stock sin intervención manual"
          checked={syncAuto}
          onChange={setSyncAuto}
        />
        <ToggleRow
          label="Notificar cuando el stock sea bajo"
          desc="Alerta cuando un medicamento caiga por debajo del mínimo configurado"
          checked={notifBajoStock}
          onChange={setNotifBajoStock}
        />
      </Card>
    </>
  );
}

/* ── Root export ────────────────────────────────────────── */
export function SettingsView({ role, userName }: SettingsViewProps) {
  const roleLabel: Record<Role, string> = {
    patient: "Paciente",
    doctor: "Médico",
    pharmacy: "Farmacia",
  };

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB" }}>

      {/* Header */}
      <div className="anim-fade-in-up anim-d-0">
        <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Configuración</h1>
        <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
          Perfil:{" "}
          <span style={{ color: "#00A69D", fontWeight: 600 }}>{roleLabel[role]}</span>
          {" · "}{userName}
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-4 max-w-3xl pb-6">
        {role === "patient" && <PatientSettings userName={userName} />}
        {role === "doctor" && <DoctorSettings userName={userName} />}
        {role === "pharmacy" && <PharmacySettings userName={userName} />}
      </div>
    </div>
  );
}
