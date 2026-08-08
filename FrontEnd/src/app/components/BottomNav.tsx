import { menuByRole } from "./Sidebar";

type Role = "patient" | "doctor" | "pharmacy";
type View = string;

interface BottomNavProps {
  role: Role;
  currentView: View;
  onViewChange: (view: View) => void;
}

export function BottomNav({ role, currentView, onViewChange }: BottomNavProps) {
  const menu = menuByRole[role];
  
  // Limitar a máximo 5 items para que quepa bien
  const items = menu.slice(0, 5);

  return (
    <div 
      className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,16px)] pt-2"
      style={{ borderColor: "#E5E7EB", boxShadow: "0 -4px 12px rgba(0,0,0,0.03)" }}
    >
      {items.map((item) => {
        const active = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className="flex flex-col items-center justify-center gap-1 p-2 flex-1 rounded-xl transition-all"
            style={{
              color: active ? "#00A69D" : "#9CA3AF",
            }}
          >
            <div className={`transition-transform duration-200 ${active ? "scale-110" : "scale-100"}`}>
              {item.icon}
            </div>
            <span 
              className="text-[10px] leading-tight font-medium" 
              style={{ fontWeight: active ? 700 : 500 }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
