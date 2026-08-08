import { useState, useEffect, useRef } from "react";
import { api, getToken, removeToken, API_BASE_URL } from "./utils/api";
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
  specialty?: string;
}

const topbarLabels: Record<Role, string> = {
  patient: "Portal del Paciente",
  doctor: "Panel Médico Profesional",
  pharmacy: "Sistema Farmacéutico",
};

function getAvatarInitials(name?: string): string {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => getToken() ? "loading" : "landing");
  const [preselectedRole, setPreselectedRole] = useState<Role | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState(() => {
    return sessionStorage.getItem("currentView") || "";
  });
  
  // Notificaciones Universales (Paciente, Médico, Farmacia)
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/invitations/all-notifications`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const handleInvitationAction = async (rawId: number, action: "accept" | "reject") => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/invitations/${rawId}/${action}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
        setShowNotifications(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    try {
      const idsToClear = notifications.map((n) => n.id);
      if (idsToClear.length === 0) return;
      
      const res = await fetch(`${API_BASE_URL}/api/invitations/dismiss-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({ notification_ids: idsToClear })
      });
      
      if (res.ok) {
        setNotifications([]);
      } else {
        console.error("Error al limpiar notificaciones");
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          setUser({ role: userData.role, name: userData.full_name, avatar: userData.avatar, specialty: userData.profile?.specialty });
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
    api.getMe().then(userData => {
      setUser({ role, name, avatar, specialty: userData.profile?.specialty });
      setCurrentView(role === "pharmacy" ? "dashboard" : "home");
      setScreen("app");
    }).catch(() => {
      setUser({ role, name, avatar });
      setCurrentView(role === "pharmacy" ? "dashboard" : "home");
      setScreen("app");
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("doctor_active_teleconsult");
    localStorage.removeItem("patient_active_teleconsult");
    localStorage.setItem("doctor_user_left_call", "true");
    localStorage.setItem("patient_user_left_call", "true");

    try {
      fetch(`${API_BASE_URL}/api/realtime/leave/global/patient`, { method: "POST" });
      fetch(`${API_BASE_URL}/api/realtime/leave/global/doctor`, { method: "POST" });
    } catch (e) {}

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
        return <DoctorDashboard userName={user.name} userAvatar={user.avatar} currentView={currentView} onNavigate={(v) => setCurrentView(v)} />;
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
          className="flex items-center justify-between px-6 border-b flex-shrink-0 transition-all duration-300 ease-in-out"
          style={{ 
            background: "white", 
            borderColor: "#E5E7EB", 
            height: (currentView === "live_teleconsult" || (currentView === "teleconsult" && user.role === "patient")) ? "0px" : "66px",
            opacity: (currentView === "live_teleconsult" || (currentView === "teleconsult" && user.role === "patient")) ? 0 : 1,
            borderBottomWidth: (currentView === "live_teleconsult" || (currentView === "teleconsult" && user.role === "patient")) ? "0px" : "1px",
            paddingTop: (currentView === "live_teleconsult" || (currentView === "teleconsult" && user.role === "patient")) ? "0px" : undefined,
            paddingBottom: (currentView === "live_teleconsult" || (currentView === "teleconsult" && user.role === "patient")) ? "0px" : undefined
          }}
        >
          <div />
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center border transition-colors hover:bg-gray-50"
                style={{ borderColor: "#E5E7EB" }}
              >
                <Bell size={18} style={{ color: "#6B7280" }} />
                {notifications.length > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ background: "#EF4444", fontWeight: 700 }}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Menú de Notificaciones */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-2xl shadow-xl z-50 p-4 anim-fade-in-up" style={{ borderColor: "#E5E7EB" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm" style={{ color: "#203A70" }}>Notificaciones</h3>
                    {notifications.length > 0 && (
                      <button 
                        onClick={handleClearAll} 
                        className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">No tienes notificaciones pendientes.</div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {notifications.map(item => (
                        <div key={item.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="flex gap-3 mb-1">
                            <div className="w-8 h-8 rounded-full bg-[#00A69D] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden">
                              {item.avatar && (item.avatar.startsWith("http") || item.avatar.startsWith("data:")) ? (
                                <img src={item.avatar} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                getAvatarInitials(item.sender_name || item.title)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-[#203A70] font-bold">{item.title}</div>
                              <div className="text-xs text-gray-600 leading-snug mt-0.5">{item.text}</div>
                            </div>
                          </div>

                          {item.type === "invitation" && (
                            <div className="flex gap-2 mt-2.5">
                              <button 
                                onClick={() => handleInvitationAction(item.raw_id, "accept")}
                                className="flex-1 py-1.5 rounded-lg text-white text-xs font-bold transition-opacity hover:opacity-90 shadow-sm"
                                style={{ background: "#00A69D" }}
                              >
                                Aceptar
                              </button>
                              <button 
                                onClick={() => handleInvitationAction(item.raw_id, "reject")}
                                className="flex-1 py-1.5 rounded-lg text-gray-600 text-xs font-bold border border-gray-200 transition-colors hover:bg-gray-100 bg-white"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-9 h-9 rounded-xl object-cover border" style={{ borderColor: "#E5E7EB", background: "white" }} />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm"
                  style={{ background: "#00A69D", fontWeight: 700 }}
                >
                  {getAvatarInitials(user.name)}
                </div>
              )}
              <div className="hidden sm:block">
                <div className="text-sm" style={{ color: "#203A70", fontWeight: 600, lineHeight: 1.2 }}>
                  {user.name}
                </div>
                <div className="text-xs font-semibold" style={{ color: user.role === "doctor" ? "#00A69D" : "#9CA3AF", lineHeight: 1.2 }}>
                  {user.role === "doctor" ? (user.specialty || "Médico Especialista") : user.role === "pharmacy" ? "Farmacia" : "Paciente"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-y-auto relative">{renderDashboard()}</main>
      </div>
    </div>
  );
}
