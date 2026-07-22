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
            className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl anim-scale-in"
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
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm transition-all"
        style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
        onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
        onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
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
function PatientSettings({ userName }: { userName: string }) {
  const [altoContraste, setAltoContraste] = useState(false);
  const [lse, setLse] = useState(true);
  const [subtitleSize, setSubtitleSize] = useState("Mediano");
  const [nombre, setNombre] = useState(userName);
  const [email, setEmail] = useState("paciente@gmail.com");
  const [telefono, setTelefono] = useState("+1 809-555-0000");
  const [smsCitas, setSmsCitas] = useState(true);
  const [emailCitas, setEmailCitas] = useState(true);
  const [emailRecetas, setEmailRecetas] = useState(false);

  return (
    <>
      <Card title="Accesibilidad" icon={<Eye size={16} />} delay={60}>
        <ToggleRow
          label="Alto Contraste"
          desc="Aumenta el contraste de colores para mayor legibilidad"
          checked={altoContraste}
          onChange={setAltoContraste}
        />
        <SegmentedControl
          label="Tamaño de Subtítulos"
          desc="Tamaño del texto en subtítulos de teleconsulta"
          options={["Pequeño", "Mediano", "Grande"]}
          value={subtitleSize}
          onChange={setSubtitleSize}
        />
        <ToggleRow
          label="Preferencia de Lenguaje de Señas (LSE)"
          desc="Activa el módulo LSE automáticamente en todas las teleconsultas"
          checked={lse}
          onChange={setLse}
        />
      </Card>

      <Card title="Cuenta y Datos Personales" icon={<User size={16} />} delay={120}>
        <div className="py-4 space-y-4">
          <ProfileImageUpload userName={userName} />
          <FieldInput label="Nombre Completo" value={nombre} onChange={setNombre} placeholder="Tu nombre completo" />
          <FieldInput label="Correo Electrónico" value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" />
          <FieldInput label="Teléfono" value={telefono} onChange={setTelefono} placeholder="+1 809-000-0000" type="tel" />
        </div>
      </Card>

      <Card title="Notificaciones" icon={<Bell size={16} />} delay={180}>
        <ToggleRow
          label="SMS para recordatorio de citas"
          desc="Mensaje de texto 2 horas antes de cada cita médica"
          checked={smsCitas}
          onChange={setSmsCitas}
        />
        <ToggleRow
          label="Email al confirmar o cancelar una cita"
          desc="Recibe un correo cuando el estado de tu cita cambie"
          checked={emailCitas}
          onChange={setEmailCitas}
        />
        <ToggleRow
          label="Email al emitir una receta"
          desc="Notificación cuando tu médico genere una nueva receta"
          checked={emailRecetas}
          onChange={setEmailRecetas}
        />
      </Card>
    </>
  );
}

/* ── Doctor ─────────────────────────────────────────────── */
function DoctorSettings({ userName }: { userName: string }) {
  const [especialidad, setEspecialidad] = useState("Cardiología");
  const [exequatur, setExequatur] = useState("EX-2019-00487");
  const [firma, setFirma] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("17:00");
  const [iaSpeed, setIaSpeed] = useState("Normal");
  const [iaAuto, setIaAuto] = useState(true);
  const [iaSubtitles, setIaSubtitles] = useState(true);
  const [days, setDays] = useState<Record<string, boolean>>({
    L: true, M: true, X: true, J: true, V: true, S: false, D: false,
  });
  const dayNames: Record<string, string> = { L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo" };

  const toggleDay = (key: string) => setDays((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <Card title="Perfil Profesional" icon={<Stethoscope size={16} />} delay={60}>
        <div className="py-4 space-y-4">
          <ProfileImageUpload userName={userName} />
          <FieldInput label="Nombre" value={userName} onChange={() => {}} placeholder="Dr. Nombre Apellido" />
          <FieldInput label="Especialidad Médica" value={especialidad} onChange={setEspecialidad} placeholder="Ej: Cardiología" />
          <FieldInput label="N.º de Exequátur / Licencia" value={exequatur} onChange={setExequatur} placeholder="EX-YYYY-00000" />
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>
              Firma Digital
              <span className="ml-2 text-xs" style={{ color: "#9CA3AF", fontWeight: 400 }}>
                (texto o iniciales)
              </span>
            </label>
            <textarea
              value={firma}
              onChange={(e) => setFirma(e.target.value)}
              placeholder="Dr. García · Cardiología · EX-2019-00487"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border outline-none resize-none text-sm transition-all"
              style={{ borderColor: "#E5E7EB", color: "#374151", fontFamily: "Georgia, serif", background: "white" }}
              onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>
        </div>
      </Card>

      <Card title="Consultorio Virtual" icon={<Clock size={16} />} delay={120}>
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
                  className="w-10 h-10 rounded-xl text-sm transition-all"
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
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm"
                style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>Hora de cierre</label>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm"
                style={{ borderColor: "#E5E7EB", color: "#374151", background: "white" }}
                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>
          </div>
        </div>

        {/* IA translator */}
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "4px" }}>
          <p className="text-xs mt-3 mb-0.5" style={{ color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Traductor IA LSE
          </p>
          <SegmentedControl
            label="Velocidad de procesamiento"
            desc="Equilibrio entre rapidez y precisión de la traducción"
            options={["Rápido", "Normal", "Preciso"]}
            value={iaSpeed}
            onChange={setIaSpeed}
          />
          <ToggleRow
            label="Activar traductor automáticamente"
            desc="El módulo LSE inicia solo al comenzar una teleconsulta"
            checked={iaAuto}
            onChange={setIaAuto}
          />
          <ToggleRow
            label="Subtítulos visibles al paciente"
            desc="Muestra los subtítulos en la pantalla del paciente durante la consulta"
            checked={iaSubtitles}
            onChange={setIaSubtitles}
          />
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
          <FieldInput label="Nombre de la Farmacia" value={userName} onChange={() => {}} placeholder="Farmacia XYZ" />

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
        {role === "patient"  && <PatientSettings  userName={userName} />}
        {role === "doctor"   && <DoctorSettings   userName={userName} />}
        {role === "pharmacy" && <PharmacySettings userName={userName} />}
      </div>
    </div>
  );
}
