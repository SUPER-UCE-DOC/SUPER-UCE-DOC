import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Eye, EyeOff, User, Stethoscope, Building2, AlertCircle, ArrowLeft, MapPin } from "lucide-react";
import { api } from "../utils/api";
import { EmailVerificationModal } from "./EmailVerificationModal";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { PharmacyMapPicker } from "./PharmacyMapPicker";
import { Map, AdvancedMarker, APIProvider } from "@vis.gl/react-google-maps";

const logoImg = new URL("../../imports/image-1.png", import.meta.url).href;

type Role = "patient" | "doctor" | "pharmacy";
type AuthMode = "login" | "register";

interface LoginPageProps {
  onLogin: (role: Role, name: string, avatar?: string) => void;
  preselectedRole?: Role;
  onBack?: () => void;
}

const roles: { id: Role; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "patient", label: "Soy Paciente", icon: <User size={18} />, desc: "Accede a telemedicina y recetas" },
  { id: "doctor", label: "Soy Médico", icon: <Stethoscope size={18} />, desc: "Gestiona pacientes y consultas" },
  { id: "pharmacy", label: "Soy Farmacia", icon: <Building2 size={18} />, desc: "Administra pedidos y recetas" },
];

export function LoginPage({ onLogin, preselectedRole, onBack }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(preselectedRole ?? "patient");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Location states
  const [lat, setLat] = useState(18.463);
  const [lon, setLon] = useState(-69.304);
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const updateHeight = () => setContentHeight(node.scrollHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const handleBack = () => {
    if (!onBack || isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => onBack(), 260);
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  interface GoogleStepData {
    token: string;
    email: string;
    name: string;
    picture?: string;
  }

  const [googleStepData, setGoogleStepData] = useState<GoogleStepData | null>(null);
  const [googleImgError, setGoogleImgError] = useState(false);

  const handleGoogleLogin = () => {
    setError("");
    if (selectedRole !== "patient") {
      setError("La autenticación a través de Google está disponible únicamente para cuentas de Paciente.");
      return;
    }
    if (!(window as any).google) {
      setError("El servicio de autenticación se está inicializando. Por favor, intente de nuevo en unos segundos.");
      return;
    }
    setLoading(true);
    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1098656113946-localhost.apps.googleusercontent.com";
      console.log("Using Google Client ID:", clientId);
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              // 1. Obtener la info del usuario de Google
              let googleInfo = { email: "", name: "", picture: "" };
              try {
                const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenResponse.access_token}`);
                if (res.ok) {
                  googleInfo = await res.json();
                }
              } catch (e) {
                console.error("Error obteniendo usuario de Google:", e);
              }

              // 2. Verificar si la cuenta YA EXISTE en el sistema
              try {
                await api.loginWithGoogle(tokenResponse.access_token, "patient", { is_creation_step: false });
                const profile = await api.getMe();

                if (profile.role !== "patient") {
                  localStorage.removeItem("token");
                  setLoading(false);
                  const roleLabels: Record<string, string> = { patient: "Paciente", doctor: "Médico", pharmacy: "Farmacia" };
                  setError(`Esta dirección de correo electrónico ya se encuentra registrada bajo el rol de '${roleLabels[profile.role] || profile.role}'. Por favor, seleccione ese perfil para iniciar sesión.`);
                  return;
                }

                // ¡La cuenta YA EXISTÍA! Iniciar sesión directamente sin volver a registrarla
                setLoading(false);
                onLogin(profile.role as Role, profile.full_name, profile.avatar);
                return;
              } catch (err: any) {
                // Si la cuenta existe con otro rol, mostrar error de rol
                if (err.message && err.message.includes("registrada")) {
                  setError(err.message);
                  setLoading(false);
                  return;
                }
                // Si la cuenta NO existe aún (ACCOUNT_NOT_FOUND), abrir el paso de registro
              }

              // 3. Abrir cuadro compacto para completar datos requeridos del paciente
              setName(googleInfo.name || "");
              setGoogleImgError(false);
              setGoogleStepData({
                token: tokenResponse.access_token,
                email: googleInfo.email || "",
                name: googleInfo.name || "",
                picture: googleInfo.picture
              });
              setLoading(false);
              setError("");
            } catch (err: any) {
              setError(err.message || "No se pudo verificar la sesión. Por favor, intente nuevamente.");
              setLoading(false);
            }
          } else {
            setError("No se pudo completar el proceso de autenticación. Por favor, intente nuevamente.");
            setLoading(false);
          }
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      setError(err.message || "Error al iniciar el proceso de autenticación.");
      setLoading(false);
    }
  };

  const handleCompleteGoogleRegistration = async () => {
    if (!googleStepData) return;
    setLoading(true);
    setError("");

    try {
      await api.loginWithGoogle(googleStepData.token, "patient", {
        is_creation_step: true,
        full_name: name || googleStepData.name,
        age: parseInt(age) || 30,
        condition: condition || "General",
      });

      const profile = await api.getMe();
      setLoading(false);
      setGoogleStepData(null);
      onLogin(profile.role as Role, profile.full_name, profile.avatar);
    } catch (err: any) {
      setError(err.message || "No se pudo completar el registro de su cuenta. Por favor, intente nuevamente.");
      setLoading(false);
    }
  };

  const [specialty, setSpecialty] = useState("Medicina General");
  const [exequatur, setExequatur] = useState("");
  const [idCard, setIdCard] = useState("");
  const [age, setAge] = useState("");
  const [condition, setCondition] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [rnc, setRnc] = useState("");
  const [healthLicense, setHealthLicense] = useState("");
  const [pharmacistName, setPharmacistName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [doctorGender, setDoctorGender] = useState<"M" | "F">("M");
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (authMode === "register" && regStep === 1) {
      if (!name || !email || !password) {
        setError("Por favor completa tu nombre, correo electrónico y contraseña.");
        return;
      }
      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      setRegStep(2);
      return;
    }

    if (authMode === "login" && (!email || !password)) {
      setError("Por favor ingresa tu correo electrónico y contraseña.");
      return;
    }

    setLoading(true);

    try {
      if (authMode === "register") {
        let fullNameToSend = name.trim();
        if (selectedRole === "doctor") {
          const cleanName = fullNameToSend.replace(/^(Dr\.|Dra\.|Doctor|Doctora)\s+/i, "");
          const prefix = doctorGender === "F" ? "Dra." : "Dr.";
          fullNameToSend = `${prefix} ${cleanName}`;
        }

        const regRes = await api.register({
          email,
          password,
          full_name: fullNameToSend,
          role: selectedRole,
          specialty: selectedRole === "doctor" ? (specialty || "Medicina General") : undefined,
          exequatur: selectedRole === "doctor" ? (exequatur || "Pendiente") : undefined,
          id_card: selectedRole === "doctor" ? (idCard || "000-0000000-0") : undefined,
          age: selectedRole === "patient" ? (parseInt(age) || 30) : undefined,
          condition: selectedRole === "patient" ? (condition || "General") : undefined,
          business_name: selectedRole === "pharmacy" ? (businessName || name) : undefined,
          rnc: selectedRole === "pharmacy" ? (rnc || "1-00-00000-0") : undefined,
          health_license: selectedRole === "pharmacy" ? (healthLicense || "MISPAS-PEND") : undefined,
          pharmacist_name: selectedRole === "pharmacy" ? pharmacistName : undefined,
          address: selectedRole === "pharmacy" ? (address || "San Pedro de Macorís, RD") : undefined,
          google_place_id: selectedRole === "pharmacy" ? googlePlaceId : undefined,
          lat: selectedRole === "pharmacy" ? lat : 18.46,
          lon: selectedRole === "pharmacy" ? lon : -69.30,
          phone: (selectedRole === "doctor" || selectedRole === "pharmacy") ? (phone || "809-529-0000") : undefined
        });

        if (regRes && regRes.requires_verification) {
          setLoading(false);
          setVerificationEmail(email);
          setShowVerificationModal(true);
          return;
        }
      }

      // Realizar login pasando el rol solicitado
      await api.login(email, password, selectedRole);
      const profile = await api.getMe();

      if (profile.role === "patient") {
        if (localStorage.getItem("lsa_preference") === null) {
          localStorage.setItem("lsa_preference", "true");
        }
        if (localStorage.getItem("settings_video_subtitles_enabled") === null) {
          localStorage.setItem("settings_video_subtitles_enabled", "true");
        }
      }

      setLoading(false);
      onLogin(profile.role as Role, profile.full_name, profile.avatar);
    } catch (err: any) {
      if (err.message && (err.message.includes("verificación") || err.message.includes("verificar"))) {
        setVerificationEmail(email);
        setShowVerificationModal(true);
      } else {
        setError(err.message || "Ocurrió un error en la autenticación.");
      }
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#FFFFFF" }}
    >
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full"
        style={{ background: "#00A69D", opacity: 0.06, filter: "blur(90px)", transform: "translate(30%, -30%)" }}
      />
      <div
        className="absolute bottom-0 left-0 w-80 h-80 rounded-full"
        style={{ background: "#203A70", opacity: 0.07, filter: "blur(80px)", transform: "translate(-30%, 30%)" }}
      />

      {onBack && (
        <button
          onClick={handleBack}
          className="absolute top-6 left-6 flex items-center gap-2 text-sm transition-all duration-200 active:scale-95"
          style={{ color: "#6B7280" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#203A70")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6B7280")}
        >
          <ArrowLeft size={16} /> Volver al inicio
        </button>
      )}

      <div
        className={`relative w-full mx-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          authMode === "register" && selectedRole === "pharmacy" && regStep === 2 ? "max-w-[1400px]" : "max-w-md"
        }`}
        style={{
          opacity: isLeaving ? 0 : 1,
          transform: isLeaving ? "translateX(18px) scale(0.985)" : "translateX(0) scale(1)",
        }}
      >
        <div className={`text-center mb-8 anim-fade-in-up anim-d-0 transition-all duration-500 ${
          authMode === "register" && selectedRole === "pharmacy" && regStep === 2 ? "hidden" : "w-full"
        }`}>
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src={logoImg}
              alt="SUPER-UCE DOC"
              style={{ height: "72px", width: "auto", display: "block" }}
            />
          </div>
          <p className="text-sm" style={{ color: "#6B7280" }}>Plataforma Médica Interdisciplinaria</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          {/* Columna Izquierda: Formulario */}
          <div className="w-full md:max-w-md shrink-0 transition-all duration-500">

        <div
          className="bg-white rounded-2xl overflow-hidden anim-scale-in anim-d-1"
          style={{
            border: "2px solid #203A70",
            boxShadow: "0 8px 32px rgba(32,58,112,0.10)",
          }}
        >
          {!googleStepData && (
            <div className="flex" style={{ background: "#F9FAFB" }}>
              {(["login", "register"] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setAuthMode(mode); setError(""); setRegStep(1); }}
                  className="flex-1 py-3 text-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white active:scale-[0.98]"
                  style={{
                    color: authMode === mode ? "#203A70" : "#6B7280",
                    borderBottom: authMode === mode ? "2px solid #00A69D" : "2px solid transparent",
                    fontWeight: authMode === mode ? 600 : 400,
                    background: "transparent",
                  }}
                >
                  {mode === "login" ? "Iniciar Sesión" : "Registrarse"}
                </button>
              ))}
            </div>
          )}

          <div
            className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ height: contentHeight === undefined ? "auto" : `${contentHeight}px` }}
          >
            <div ref={contentRef} className="p-8">
              {googleStepData ? (
                <div className="anim-fade-in space-y-4">
                  {/* Google User Profile Header */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border" style={{ background: "#F9FAFB", borderColor: "#E5E7EB" }}>
                    {googleStepData.picture && !googleImgError ? (
                      <img
                        src={googleStepData.picture}
                        alt="Avatar"
                        referrerPolicy="no-referrer"
                        onError={() => setGoogleImgError(true)}
                        className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-sm" style={{ background: "#00A69D" }}>
                        {googleStepData.name ? googleStepData.name.substring(0, 2).toUpperCase() : "G"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Autenticación Verificada</p>
                      <p className="text-sm font-bold truncate" style={{ color: "#203A70" }}>{googleStepData.name || googleStepData.email}</p>
                      <p className="text-xs text-gray-500 truncate">{googleStepData.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGoogleStepData(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 p-1 transition-colors"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#203A70" }}>
                      Paso Final • Perfil de Paciente
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      Revisa tu nombre y completa los datos requeridos para activar tu cuenta de Paciente:
                    </p>

                    <div className="mb-3">
                      <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: María López"
                        className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm transition-all bg-white"
                        style={{ borderColor: "#E5E7EB", color: "#203A70" }}
                        onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                        onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                          Edad
                        </label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="Ej: 35"
                          className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm transition-all"
                          style={{ borderColor: "#E5E7EB" }}
                          onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                          onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                          Condición / Salud
                        </label>
                        <input
                          type="text"
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          placeholder="Ej: Ninguna / HTA"
                          className="w-full px-4 py-2.5 rounded-lg border outline-none text-sm transition-all"
                          style={{ borderColor: "#E5E7EB" }}
                          onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                          onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg anim-fade-in text-sm" style={{ background: "#FEF2F2", color: "#EF4444" }}>
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setGoogleStepData(null)}
                      className="flex-1 py-2.5 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      style={{ borderColor: "#E5E7EB" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || (authMode === "register" && selectedRole === "pharmacy" && regStep === 2 && !googlePlaceId)}
                      className="w-full py-3 mt-4 rounded-lg font-bold text-white transition-all duration-300 shadow-md active:scale-[0.98]"
                      style={{
                        background: loading || (authMode === "register" && selectedRole === "pharmacy" && regStep === 2 && !googlePlaceId) ? "#9CA3AF" : "#00A69D",
                      }}
                    >
                      {loading
                        ? "Procesando..."
                        : authMode === "login"
                        ? "Iniciar Sesión"
                        : regStep === 1
                        ? "Siguiente Paso"
                        : "Completar Registro"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "#6B7280", fontWeight: 600 }}>
                      Selecciona tu rol
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          onClick={() => { setSelectedRole(role.id); setError(""); setRegStep(1); }}
                          className="flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:scale-[0.97]"
                          style={{
                            borderColor: selectedRole === role.id ? "#00A69D" : "#E5E7EB",
                            background: selectedRole === role.id ? "#F0FFFE" : "white",
                            color: selectedRole === role.id ? "#00A69D" : "#6B7280",
                            boxShadow: selectedRole === role.id ? "0 8px 20px rgba(0,166,157,0.12)" : "0 0 0 rgba(0,0,0,0)",
                            transform: selectedRole === role.id ? "translateY(-2px)" : "translateY(0)",
                          }}
                        >
                          <span className="mb-1">{role.icon}</span>
                          <span className="text-xs transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ fontWeight: selectedRole === role.id ? 600 : 400, lineHeight: "1.2" }}>
                            {role.label.split(" ").slice(1).join(" ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div key={`${authMode}-${regStep}`} className="anim-fade-in-up anim-d-0 space-y-4">
                      {/* Step Indicator when registering */}
                      {authMode === "register" && (
                        <div className="flex items-center justify-between mb-4 p-2.5 rounded-xl border" style={{ background: "#F9FAFB", borderColor: "#E5E7EB" }}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm"
                              style={{
                                background: regStep === 1 ? "#00A69D" : "#203A70",
                                color: "white"
                              }}
                            >
                              1
                            </div>
                            <span className="text-xs font-bold" style={{ color: "#203A70" }}>
                              Acceso y Cuenta
                            </span>
                          </div>

                          <div className="flex-1 h-0.5 mx-3 transition-colors duration-300" style={{ background: regStep === 2 ? "#00A69D" : "#D1D5DB" }} />

                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm"
                              style={{
                                background: regStep === 2 ? "#00A69D" : "#E5E7EB",
                                color: regStep === 2 ? "white" : "#6B7280"
                              }}
                            >
                              2
                            </div>
                            <span className="text-xs font-bold" style={{ color: regStep === 2 ? "#203A70" : "#9CA3AF" }}>
                              {selectedRole === "doctor" ? "Acreditación Médica" : selectedRole === "pharmacy" ? "Habilitación Legal" : "Perfil de Salud"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* PASO 1 (Login OR Register Step 1) */}
                      {(authMode === "login" || regStep === 1) && (
                        <>
                          {authMode === "register" && (
                            <>
                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  {selectedRole === "pharmacy" ? "Nombre del Representante / Contacto" : "Nombre Completo"}
                                </label>
                                <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setName(e.target.value)}
                                  placeholder={selectedRole === "doctor" ? "Juan García" : selectedRole === "pharmacy" ? "Lic. Carlos Méndez" : "María López"}
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>

                              {selectedRole === "doctor" && (
                                <div>
                                  <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                    Prefijo de Título Profesional
                                  </label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setDoctorGender("M")}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm transition-all"
                                      style={{
                                        borderColor: doctorGender === "M" ? "#00A69D" : "#E5E7EB",
                                        background: doctorGender === "M" ? "#F0FFFE" : "white",
                                        color: doctorGender === "M" ? "#00A69D" : "#4B5563",
                                        fontWeight: doctorGender === "M" ? 600 : 400
                                      }}
                                    >
                                      <span>👨‍⚕️</span> Dr. (Masculino)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDoctorGender("F")}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm transition-all"
                                      style={{
                                        borderColor: doctorGender === "F" ? "#00A69D" : "#E5E7EB",
                                        background: doctorGender === "F" ? "#F0FFFE" : "white",
                                        color: doctorGender === "F" ? "#00A69D" : "#4B5563",
                                        fontWeight: doctorGender === "F" ? 600 : 400
                                      }}
                                    >
                                      <span>👩‍⚕️</span> Dra. (Femenino)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          <div>
                            <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                              Correo {selectedRole === "doctor" || selectedRole === "pharmacy" ? "Institucional" : "Electrónico"}
                            </label>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={selectedRole === "doctor" ? "medico@hospital.edu" : selectedRole === "pharmacy" ? "farmacia@empresa.com" : "paciente@gmail.com"}
                              className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                              style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                              onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                            />
                          </div>

                          <div>
                            <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                              Contraseña
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all pr-12"
                                style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 active:scale-90"
                                style={{ color: "#6B7280" }}
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {/* PASO 2 (Register Step 2) */}
                      {authMode === "register" && regStep === 2 && (
                        <>
                          {selectedRole === "doctor" && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Especialidad Médica
                                </label>
                                <select
                                  value={specialty}
                                  onChange={(e) => setSpecialty(e.target.value)}
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all bg-white"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px", color: "#203A70" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                >
                                  <option value="Medicina General">Medicina General</option>
                                  <option value="Cardiología">Cardiología</option>
                                  <option value="Pediatría">Pediatría</option>
                                  <option value="Neurología">Neurología</option>
                                  <option value="Dermatología">Dermatología</option>
                                  <option value="Gineco-Obstetricia">Gineco-Obstetricia</option>
                                  <option value="Traumatología">Traumatología</option>
                                  <option value="Oftalmología">Oftalmología</option>
                                  <option value="Psiquiatría">Psiquiatría</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                    Exequátur de Ley
                                  </label>
                                  <input
                                    type="text"
                                    value={exequatur}
                                    onChange={(e) => setExequatur(e.target.value)}
                                    placeholder="Ej: 12345-67"
                                    className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                    style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                    onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                    onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                    Cédula / ID
                                  </label>
                                  <input
                                    type="text"
                                    value={idCard}
                                    onChange={(e) => setIdCard(e.target.value)}
                                    placeholder="001-0000000-0"
                                    className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                    style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                    onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                    onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Teléfono de Consultorio
                                </label>
                                <input
                                  type="text"
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  placeholder="809-529-0000"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>
                            </div>
                          )}

                          {selectedRole === "patient" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Edad
                                </label>
                                <input
                                  type="number"
                                  value={age}
                                  onChange={(e) => setAge(e.target.value)}
                                  placeholder="Ej: 35"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>
                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Condición / Salud
                                </label>
                                <input
                                  type="text"
                                  value={condition}
                                  onChange={(e) => setCondition(e.target.value)}
                                  placeholder="Ej: Ninguna / HTA"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>
                            </div>
                          )}

                          {selectedRole === "pharmacy" && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Nombre Comercial de la Farmacia
                                </label>
                                <input
                                  type="text"
                                  value={businessName}
                                  onChange={(e) => setBusinessName(e.target.value)}
                                  placeholder="Ej: Farmacia Central UCE"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                    RNC (Registro Fiscal)
                                  </label>
                                  <input
                                    type="text"
                                    value={rnc}
                                    onChange={(e) => setRnc(e.target.value)}
                                    placeholder="1-30-12345-6"
                                    className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                    style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                    onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                    onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                    Licencia MISPAS
                                  </label>
                                  <input
                                    type="text"
                                    value={healthLicense}
                                    onChange={(e) => setHealthLicense(e.target.value)}
                                    placeholder="MISPAS-F-2026"
                                    className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                    style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                    onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                    onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Farmacéutico Regente Titular
                                </label>
                                <input
                                  type="text"
                                  value={pharmacistName}
                                  onChange={(e) => setPharmacistName(e.target.value)}
                                  placeholder="Dra. María Almonte"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>

                              <div>
                                <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                                  Teléfono de la Farmacia
                                </label>
                                <input
                                  type="text"
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  placeholder="809-529-1111"
                                  className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                                  style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                                />
                              </div>

                              <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl">
                                <p className="text-sm text-teal-800 font-medium mb-2 flex items-center gap-2">
                                  <MapPin size={16} /> Ubicación de la Farmacia
                                </p>
                                {googlePlaceId ? (
                                  <div className="text-xs text-teal-700">
                                    <p className="font-bold">{address}</p>
                                    <p className="mt-1">Seleccionada en el mapa</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-teal-600">Por favor selecciona la ubicación exacta de tu farmacia en el mapa de la derecha.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg anim-fade-in" style={{ background: "#FEF2F2", color: "#EF4444" }}>
                          <AlertCircle size={16} />
                          <span className="text-sm">{error}</span>
                        </div>
                      )}

                      {authMode === "login" && (
                        <div className="flex justify-end anim-fade-in-up anim-d-0">
                          <button type="button" className="text-sm transition-all duration-200 hover:translate-x-0.5 active:scale-95" style={{ color: "#00A69D", fontWeight: 500 }}>
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                      )}

                      {/* Action buttons depending on mode and step */}
                      {authMode === "register" && regStep === 2 ? (
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setRegStep(1)}
                            className="flex-1 py-3 border rounded-lg text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95"
                            style={{ borderColor: "#E5E7EB", color: "#4B5563" }}
                          >
                            Regresar
                          </button>
                          <button
                            type="submit"
                            disabled={loading || (authMode === "register" && selectedRole === "pharmacy" && regStep === 2 && !googlePlaceId)}
                            className="flex-[2] py-3 rounded-lg text-white font-semibold text-sm transition-all shadow-md active:scale-[0.98]"
                            style={{ background: loading || (authMode === "register" && selectedRole === "pharmacy" && regStep === 2 && !googlePlaceId) ? "#9CA3AF" : "#00A69D" }}
                          >
                            {loading ? "Completando..." : "Completar Registro"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3 rounded-lg text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] mt-2 active:scale-[0.98]"
                          style={{
                            background: loading ? "#6B7280" : "#00A69D",
                            fontWeight: 600,
                            fontSize: "16px",
                            boxShadow: loading ? "none" : "0 10px 24px rgba(0,166,157,0.18)",
                          }}
                          onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.background = "#009690")}
                          onMouseLeave={(e) => !loading && ((e.target as HTMLElement).style.background = "#00A69D")}
                        >
                          {loading ? "Verificando..." : authMode === "login" ? "Ingresar al Sistema" : "Continuar"}
                        </button>
                      )}
                    </div>
                  </form>

                  {selectedRole === "patient" && (
                    <div className="mt-4">
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
                        <span className="text-xs" style={{ color: "#9CA3AF" }}>o continúa con</span>
                        <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
                      </div>
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border transition-all"
                        style={{ borderColor: "#E5E7EB", background: "white", fontWeight: 600, fontSize: "14px", color: "#374151" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F9FAFB")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "white")}
                      >
                        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.09 29.5 1 24 1 14.82 1 7.07 6.48 3.69 14.28l7.09 5.51C12.5 13.74 17.8 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.73H24v8.96h12.43c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.27 37.26 46.1 31.36 46.1 24.55z" />
                          <path fill="#FBBC05" d="M10.78 28.21A14.6 14.6 0 0 1 9.5 24c0-1.46.25-2.87.68-4.21l-7.09-5.51A23.93 23.93 0 0 0 0 24c0 3.88.93 7.54 2.56 10.79l8.22-6.58z" />
                          <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.94l-7.19-5.59c-1.83 1.23-4.18 1.96-6.3 1.96-6.2 0-11.5-4.24-13.22-9.94l-8.22 6.58C7.07 41.52 14.82 47 24 47z" />
                          <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                        {authMode === "login" ? "Iniciar sesión con Google" : "Registrarse con Google"}
                      </button>
                    </div>
                  )}

                  <div className={`mt-6 pt-4 border-t border-gray-100 text-center transition-all duration-500 ${authMode === "register" && selectedRole === "pharmacy" && regStep === 2 ? "hidden" : "block"}`}>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      Plataforma segura conforme a estándares de salud — HIPAA / HL7
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Columna Derecha: Mapa de Farmacia (Solo paso 2) */}
        {authMode === "register" && selectedRole === "pharmacy" && regStep === 2 && (
          <div className="flex-1 w-full h-[500px] md:h-auto anim-fade-in-right rounded-2xl overflow-hidden shadow-2xl border-4 border-white mb-8 md:mb-0">
            <PharmacyMapPicker
              selectedPlaceId={googlePlaceId}
              onConfirm={(placeId, addr, latit, longit, placeName) => {
                setGooglePlaceId(placeId);
                setAddress(addr);
                setLat(latit);
                setLon(longit);
                if (placeName) {
                  setBusinessName(placeName);
                }
              }}
            />
          </div>
        )}
        </div>

        {/* Footer Text */}
        <p className="text-center mt-6 text-xs transition-all duration-500" style={{ color: "#9CA3AF" }}>
          © 2026 SUPER-UCE DOC · Universidad Central del Este
        </p>
      </div>

      {showVerificationModal && (
        <EmailVerificationModal
          isOpen={showVerificationModal}
          email={verificationEmail}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={(user) => {
            setShowVerificationModal(false);
            onLogin(user.role as Role, user.full_name, user.avatar);
          }}
        />
      )}
    </div>
  );
}
