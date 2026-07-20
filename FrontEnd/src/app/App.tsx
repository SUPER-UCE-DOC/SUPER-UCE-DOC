import { useState, useEffect } from "react";
import { api, getToken, removeToken } from "./utils/api";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { Sidebar } from "./components/Sidebar";
import { PatientDashboard } from "./components/PatientDashboard";
import { DoctorDashboard } from "./components/DoctorDashboard";
import { PharmacyDashboard } from "./components/PharmacyDashboard";
import { Bell, Search, HelpCircle } from "lucide-react";

type Role = "patient" | "doctor" | "pharmacy";
type Screen = "loading" | "landing" | "login" | "app";

interface User {
  role: Role;
  name: string;
  avatar?: string;
}

const topbarLabels: Record<Role, string> = {
  patient: "Portal del Paciente",
  doctor: "Panel Médico Profesional",
  pharmacy: "Sistema Farmacéutico",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => getToken() ? "loading" : "landing");
  const [preselectedRole, setPreselectedRole] = useState<Role | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState(() => {
    return sessionStorage.getItem("currentView") || "";
  });
  const [notifications] = useState(3);

  useEffect(() => {
    if (currentView) {
      sessionStorage.setItem("currentView", currentView);
    }
  }, [currentView]);

  useEffect(() => {
    const token = getToken();
    const fetchUser = () => {
      if (token) {
        api.getMe().then(userData => {
          setUser({ role: userData.role, name: userData.full_name, avatar: userData.avatar });
          if (!sessionStorage.getItem("currentView")) {
            setCurrentView(userData.role === "pharmacy" ? "dashboard" : "home");
          }
          setScreen("app");
        }).catch(err => {
          console.error("Sesión expirada o inválida", err);
          removeToken();
          setScreen("landing");
        });
      }
    };
    
    fetchUser();
    
    window.addEventListener("avatarUpdated", fetchUser);
    return () => window.removeEventListener("avatarUpdated", fetchUser);
  }, []);

  const handleEnterPortal = (role?: Role) => {
    setPreselectedRole(role);
    setScreen("login");
  };

  const handleLogin = (role: Role, name: string, avatar?: string) => {
    setUser({ role, name, avatar });
    setCurrentView(role === "pharmacy" ? "dashboard" : "home");
    setScreen("app");
  };

  const handleLogout = () => {
    setUser(null);
    setPreselectedRole(undefined);
    setCurrentView("");
    sessionStorage.removeItem("currentView");
    setScreen("login");
    removeToken();
  };

  if (screen === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#F9FAFB" }}>
        <div className="flex items-center gap-3">
           <div className="w-4 h-4 rounded-full animate-bounce" style={{ background: "#00A69D", animationDelay: "0s" }} />
           <div className="w-4 h-4 rounded-full animate-bounce" style={{ background: "#203A70", animationDelay: "0.15s" }} />
           <div className="w-4 h-4 rounded-full animate-bounce" style={{ background: "#00C7C0", animationDelay: "0.3s" }} />
        </div>
      </div>
    );
  }

  if (screen === "landing") {
    return <LandingPage onEnterPortal={handleEnterPortal} />;
  }

  if (screen === "login") {
    return <LoginPage onLogin={handleLogin} preselectedRole={preselectedRole} onBack={() => setScreen("landing")} />;
  }

  if (!user) return null;

  const renderDashboard = () => {
    switch (user.role) {
      case "patient":
        return <PatientDashboard userName={user.name} userAvatar={user.avatar} currentView={currentView} onNavigate={(v) => setCurrentView(v)} />;
      case "doctor":
        return <DoctorDashboard userName={user.name} currentView={currentView} onNavigate={(v) => setCurrentView(v)} />;
      case "pharmacy":
        return <PharmacyDashboard userName={user.name} currentView={currentView} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F9FAFB", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar
        role={user.role}
        userName={user.name}
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 border-b flex-shrink-0"
          style={{ background: "white", borderColor: "#E5E7EB", height: "66px" }}
        >
          <div />
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{ borderColor: "#E5E7EB", background: "#F9FAFB" }}
            >
              <Search size={14} style={{ color: "#9CA3AF" }} />
              <input
                placeholder="Buscar..."
                className="text-sm outline-none bg-transparent w-40"
                style={{ color: "#374151" }}
              />
            </div>

            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center border"
              style={{ borderColor: "#E5E7EB" }}
            >
              <HelpCircle size={18} style={{ color: "#6B7280" }} />
            </button>

            <button
              className="relative w-9 h-9 rounded-xl flex items-center justify-center border"
              style={{ borderColor: "#E5E7EB" }}
            >
              <Bell size={18} style={{ color: "#6B7280" }} />
              {notifications > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs text-white"
                  style={{ background: "#EF4444", fontWeight: 700 }}
                >
                  {notifications}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-9 h-9 rounded-xl object-cover border" style={{ borderColor: "#E5E7EB", background: "white" }} />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm"
                  style={{ background: "#00A69D", fontWeight: 700 }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block">
                <div className="text-sm" style={{ color: "#203A70", fontWeight: 600, lineHeight: 1.2 }}>
                  {user.name}
                </div>
                <div className="text-xs" style={{ color: "#9CA3AF", lineHeight: 1.2, textTransform: "capitalize" }}>
                  {user.role === "doctor" ? "Médico" : user.role === "pharmacy" ? "Farmacia" : "Paciente"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{renderDashboard()}</main>
      </div>
    </div>
  );
}
