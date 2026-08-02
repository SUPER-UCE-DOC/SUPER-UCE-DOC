import { useState, useEffect } from "react";
import {
  Calendar, Video, FileText, MessageSquareHeart,
  Settings, LogOut, ChevronLeft, ChevronRight,
  ClipboardList, Users, PackageOpen, TrendingUp, LayoutDashboard
} from "lucide-react";

const logoImg = new URL("../../imports/image-1.png", import.meta.url).href;
const logoIconImg = new URL("../../imports/image-2.png", import.meta.url).href;

type Role = "patient" | "doctor" | "pharmacy";
type View = string;

interface SidebarProps {
  role: Role;
  userName: string;
  currentView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
}

const menuByRole: Record<Role, { id: string; label: string; icon: React.ReactNode; badge?: number }[]> = {
  patient: [
    { id: "home", label: "Inicio", icon: <LayoutDashboard size={20} /> },
    { id: "appointments", label: "Mis Citas", icon: <Calendar size={20} /> },
    { id: "prescriptions", label: "Mis Recetas", icon: <FileText size={20} /> },
    { id: "ai-assistant", label: "Asistente IA", icon: <MessageSquareHeart size={20} /> },
  ],
  doctor: [
    { id: "home", label: "Inicio", icon: <LayoutDashboard size={20} /> },
    { id: "dashboard", label: "Mi Agenda", icon: <Calendar size={20} /> },
    { id: "teleconsult", label: "Telemedicina", icon: <Video size={20} /> },
    { id: "patients", label: "Pacientes", icon: <Users size={20} /> },
    { id: "prescriptions", label: "Recetas", icon: <FileText size={20} /> },
  ],
  pharmacy: [
    { id: "dashboard", label: "Recetas Entrantes", icon: <FileText size={20} /> },
    { id: "orders", label: "Pedidos", icon: <PackageOpen size={20} /> },
    { id: "inventory", label: "Inventario", icon: <ClipboardList size={20} /> },
    { id: "analytics", label: "Estadísticas", icon: <TrendingUp size={20} /> },
  ],
};

export function Sidebar({ role, userName, currentView, onViewChange, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = sessionStorage.getItem("mainSidebarCollapsed");
    return saved !== null ? saved === "true" : false;
  });

  useEffect(() => {
    sessionStorage.setItem("mainSidebarCollapsed", collapsed.toString());
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "72px" : "240px");
  }, [collapsed]);

  useEffect(() => {
    const handleForceCollapse = () => {
      setCollapsed(true);
    };
    const handleForceExpand = () => {
      setCollapsed(false);
    };
    window.addEventListener("force-sidebar-collapse", handleForceCollapse);
    window.addEventListener("force-sidebar-expand", handleForceExpand);
    return () => {
      window.removeEventListener("force-sidebar-collapse", handleForceCollapse);
      window.removeEventListener("force-sidebar-expand", handleForceExpand);
    };
  }, []);
  const menu = menuByRole[role];

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300 relative"
      style={{
        width: collapsed ? "72px" : "240px",
        background: "white",
        minHeight: "100vh",
        borderRight: "1px solid #E5E7EB",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center border-b"
        style={{
          borderColor: "#E5E7EB",
          padding: collapsed ? "10px 8px" : "10px 20px",
          minHeight: "66px",
        }}
      >
        {collapsed ? (
          <img src={logoIconImg} alt="SUPER-UCE DOC" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
        ) : (
          <img src={logoImg} alt="SUPER-UCE DOC" style={{ height: "44px", width: "auto", objectFit: "contain" }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {menu.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left relative"
              style={{
                background: active ? "#00A69D" : "transparent",
                color: active ? "white" : "#6B7280",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,166,157,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "#203A70";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#6B7280";
                }
              }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="text-sm flex-1" style={{ fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "#EF4444", color: "white", fontWeight: 700 }}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs"
                  style={{ background: "#EF4444", color: "white", fontWeight: 700 }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions — only Settings + Logout */}
      <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: "#E5E7EB" }}>
        <button
          onClick={() => onViewChange("settings")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
          style={{ color: "#6B7280" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,166,157,0.08)";
            (e.currentTarget as HTMLElement).style.color = "#203A70";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#6B7280";
          }}
        >
          <Settings size={20} />
          {!collapsed && <span className="text-sm">Configuración</span>}
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
          style={{ color: "#EF4444" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm">Cerrar Sesión</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md z-50"
        style={{ background: "#00A69D", color: "white", border: "2px solid white" }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
