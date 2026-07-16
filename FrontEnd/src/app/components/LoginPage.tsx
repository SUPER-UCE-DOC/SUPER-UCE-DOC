import { useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff, User, Stethoscope, Building2, AlertCircle, ArrowLeft } from "lucide-react";

const logoImg = new URL("../../imports/image-1.png", import.meta.url).href;

type Role = "patient" | "doctor" | "pharmacy";
type AuthMode = "login" | "register";

interface LoginPageProps {
  onLogin: (role: Role, name: string) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    if (authMode === "register" && !name) {
      setError("Por favor ingresa tu nombre completo.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(selectedRole, name || email.split("@")[0]);
    }, 1200);
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
        className="relative w-full max-w-md mx-4 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          opacity: isLeaving ? 0 : 1,
          transform: isLeaving ? "translateX(18px) scale(0.985)" : "translateX(0) scale(1)",
        }}
      >
        <div className="text-center mb-8 anim-fade-in-up anim-d-0">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src={logoImg}
              alt="SUPER-UCE DOC"
              style={{ height: "72px", width: "auto", display: "block" }}
            />
          </div>
          <p className="text-sm" style={{ color: "#6B7280" }}>Plataforma Médica Interdisciplinaria</p>
        </div>

        <div
          className="bg-white rounded-2xl overflow-hidden anim-scale-in anim-d-1"
          style={{
            border: "2px solid #203A70",
            boxShadow: "0 8px 32px rgba(32,58,112,0.10)",
          }}
        >
          <div className="flex" style={{ background: "#F9FAFB" }}>
            {(["login", "register"] as AuthMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setAuthMode(mode); setError(""); }}
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

          <div
            className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ height: contentHeight === undefined ? "auto" : `${contentHeight}px` }}
          >
            <div ref={contentRef} className="p-8">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "#6B7280", fontWeight: 600 }}>
                  Selecciona tu rol
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
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
                <div key={authMode} className="anim-fade-in-up anim-d-0 space-y-4">
                  {authMode === "register" && (
                    <div>
                      <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Dr. Juan García / María López"
                        className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
                        style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
                        onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
                        onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm mb-1.5" style={{ color: "#203A70", fontWeight: 500 }}>
                      Correo {selectedRole === "doctor" ? "Institucional" : "Electrónico"}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={selectedRole === "doctor" ? "medico@hospital.ec" : selectedRole === "pharmacy" ? "farmacia@nombre.ec" : "paciente@gmail.com"}
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
                    {loading ? "Verificando..." : authMode === "login" ? "Ingresar al Sistema" : "Crear Cuenta"}
                  </button>
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
                    onClick={() => onLogin("patient", "Usuario Google")}
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
                    Iniciar sesión con Google
                  </button>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs" style={{ color: "#9CA3AF" }}>
                  Plataforma segura conforme a estándares de salud — HIPAA / HL7
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "#9CA3AF" }}>
          © 2026 SUPER-UCE DOC · Universidad Central del Este
        </p>
      </div>
    </div>
  );
}
