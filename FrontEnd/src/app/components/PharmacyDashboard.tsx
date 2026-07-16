import { useState } from "react";
import { SettingsView } from "./SettingsView";
import {
  CheckCircle, Clock, Package, AlertCircle, Filter, Pill,
  Search, RefreshCw, Truck, FlaskConical, Plus, ChevronRight,
  FileText, MapPin, Building2, Calendar, DollarSign,
} from "lucide-react";

type View = string;

interface PharmacyDashboardProps {
  userName: string;
  currentView: View;
}

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
interface Prescription {
  id: string;
  patient: string;
  medicine: string;
  dose: string;
  doctor: string;
  issuedAt: string;
  urgent: boolean;
  dispatched: boolean;
  deaf: boolean;
}

type OrderStatus = "borrador" | "enviado" | "transito" | "recibido";

interface Order {
  id: string;
  supplier: string;
  items: string[];
  total: number;
  estimatedDelivery: string;
  status: OrderStatus;
  createdAt: string;
}

/* ════════════════════════════════════════
   MOCK DATA
════════════════════════════════════════ */
const initialPrescriptions: Prescription[] = [
  { id: "RX-2026-0841", patient: "Rosa Chávez", medicine: "Sertralina 50mg", dose: "30 comprimidos · 1/día", doctor: "Dr. Paredes", issuedAt: "Hoy 11:28", urgent: true, dispatched: false, deaf: true },
  { id: "RX-2026-0839", patient: "María López", medicine: "Losartán 25mg", dose: "30 comprimidos · 1/día mañana", doctor: "Dr. Mendoza", issuedAt: "Hoy 11:20", urgent: false, dispatched: false, deaf: true },
  { id: "RX-2026-0836", patient: "Juan Paredes", medicine: "Metformina 500mg", dose: "60 comprimidos · 2/día", doctor: "Dra. Torres", issuedAt: "Hoy 11:04", urgent: false, dispatched: false, deaf: false },
  { id: "RX-2026-0834", patient: "Carlos Vega", medicine: "Furosemida 40mg", dose: "30 comprimidos · 1/día", doctor: "Dr. Mendoza", issuedAt: "Hoy 10:47", urgent: true, dispatched: false, deaf: false },
  { id: "RX-2026-0831", patient: "Ana Morales", medicine: "Ácido Fólico 5mg", dose: "30 comprimidos · 1/día", doctor: "Dra. Torres", issuedAt: "Hoy 10:32", urgent: false, dispatched: false, deaf: true },
  { id: "RX-2026-0828", patient: "Pedro Gutiérrez", medicine: "Atorvastatina 20mg", dose: "30 comprimidos · 1/noche", doctor: "Dr. Paredes", issuedAt: "Hoy 09:50", urgent: false, dispatched: false, deaf: false },
];

const initialOrders: Order[] = [
  { id: "ORD-9921", supplier: "Pfizer RD", items: ["Losartán 50mg ×500u", "Atorvastatina 20mg ×300u"], total: 48500, estimatedDelivery: "17 Jul 2026", status: "transito", createdAt: "12 Jul 2026" },
  { id: "ORD-9918", supplier: "Distribuidora Nacional", items: ["Metformina 500mg ×1000u", "Omeprazol 20mg ×800u", "Paracetamol 500mg ×600u"], total: 31200, estimatedDelivery: "15 Jul 2026", status: "transito", createdAt: "11 Jul 2026" },
  { id: "ORD-9915", supplier: "MediLab Caribe", items: ["Sertralina 50mg ×200u"], total: 18750, estimatedDelivery: "20 Jul 2026", status: "enviado", createdAt: "13 Jul 2026" },
  { id: "ORD-9910", supplier: "Bayer Dominicana", items: ["Furosemida 40mg ×400u", "Amoxicilina 500mg ×500u"], total: 27300, estimatedDelivery: "22 Jul 2026", status: "enviado", createdAt: "13 Jul 2026" },
  { id: "ORD-9905", supplier: "Farma Insumos SRL", items: ["Ácido Fólico 5mg ×600u"], total: 9800, estimatedDelivery: "—", status: "borrador", createdAt: "14 Jul 2026" },
  { id: "ORD-9901", supplier: "Pfizer RD", items: ["Atorvastatina 20mg ×1000u", "Losartán 25mg ×500u"], total: 62400, estimatedDelivery: "—", status: "borrador", createdAt: "14 Jul 2026" },
  { id: "ORD-9890", supplier: "Distribuidora Nacional", items: ["Paracetamol 500mg ×2000u", "Omeprazol 20mg ×1000u"], total: 44100, estimatedDelivery: "Completado", status: "recibido", createdAt: "02 Jul 2026" },
  { id: "ORD-9882", supplier: "MediLab Caribe", items: ["Sertralina 50mg ×400u", "Ansiolítico 2mg ×200u"], total: 33600, estimatedDelivery: "Completado", status: "recibido", createdAt: "28 Jun 2026" },
];

/* ════════════════════════════════════════
   ROUTER
════════════════════════════════════════ */
export function PharmacyDashboard({ userName, currentView }: PharmacyDashboardProps) {
  if (currentView === "orders") return <PedidosView />;
  if (currentView === "inventory") return <InventoryView />;
  if (currentView === "analytics") return <AnalyticsView />;
  if (currentView === "settings") return <SettingsView role="pharmacy" userName={userName} />;
  return <RecetasEntrantes userName={userName} />;
}

/* ════════════════════════════════════════
   RECETAS ENTRANTES — gestión de pacientes
════════════════════════════════════════ */
function RecetasEntrantes({ userName }: { userName: string }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [filter, setFilter] = useState<"todas" | "urgentes" | "despachadas">("todas");

  const dispatch = (id: string) =>
    setPrescriptions((prev) => prev.map((rx) => (rx.id === id ? { ...rx, dispatched: true } : rx)));

  const pending = prescriptions.filter((r) => !r.dispatched).length;
  const urgent = prescriptions.filter((r) => r.urgent && !r.dispatched).length;
  const dispatched = prescriptions.filter((r) => r.dispatched).length;

  const filtered = prescriptions.filter((rx) => {
    if (filter === "urgentes") return rx.urgent && !rx.dispatched;
    if (filter === "despachadas") return rx.dispatched;
    return true;
  });

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Recetas Entrantes</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {userName} · Farmacia Suiza Plus · San Pedro de Macorís
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}>
          <CheckCircle size={15} /> Farmacia Activa · Radio 2 km
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-fade-in-up anim-d-1">
        {[
          { label: "Pendientes", value: pending, icon: <Clock size={18} />, bg: "#FEF3C7", color: "#D97706" },
          { label: "Urgentes", value: urgent, icon: <AlertCircle size={18} />, bg: "#FEE2E2", color: "#EF4444" },
          { label: "Despachadas", value: dispatched, icon: <CheckCircle size={18} />, bg: "#DCFCE7", color: "#10B981" },
          { label: "Total del día", value: prescriptions.length, icon: <FileText size={18} />, bg: "#F0FFFE", color: "#00A69D" },
        ].map((m, i) => (
          <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm anim-fade-in-up" style={{ animationDelay: `${60 + i * 60}ms` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: m.bg }}>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <div style={{ color: "#203A70", fontSize: "24px", fontWeight: 800, lineHeight: 1 }}>{m.value}</div>
            <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} style={{ color: "#9CA3AF" }} />
        {(["todas", "urgentes", "despachadas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-xl text-xs capitalize transition-all"
            style={{
              background: filter === f ? "#203A70" : "white",
              color: filter === f ? "white" : "#6B7280",
              border: "1px solid",
              borderColor: filter === f ? "#203A70" : "#E5E7EB",
              fontWeight: filter === f ? 700 : 400,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span className="opacity-60">({f === "todas" ? prescriptions.length : f === "urgentes" ? urgent : dispatched})</span>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <div
          className="grid items-center px-6 py-3 text-xs"
          style={{
            gridTemplateColumns: "160px 140px 1fr 1fr 120px 160px",
            background: "#F9FAFB",
            borderBottom: "1px solid #F3F4F6",
            color: "#9CA3AF",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>ID Receta</span>
          <span>Paciente</span>
          <span>Medicamento</span>
          <span>Médico</span>
          <span>Emisión</span>
          <span className="text-center">Acción</span>
        </div>

        <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2" style={{ color: "#9CA3AF" }}>
              <CheckCircle size={36} style={{ color: "#10B981" }} />
              <p className="text-sm">Sin recetas en esta categoría</p>
            </div>
          ) : filtered.map((rx) => (
            <div
              key={rx.id}
              className="grid items-center px-6 py-4"
              style={{
                gridTemplateColumns: "160px 140px 1fr 1fr 120px 160px",
                background: rx.dispatched ? "#FAFAFA" : "white",
                opacity: rx.dispatched ? 0.6 : 1,
              }}
            >
              {/* ID */}
              <div>
                <span className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{rx.id}</span>
                {rx.urgent && !rx.dispatched && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: "#EF4444", fontWeight: 700 }}>
                    URGENTE
                  </span>
                )}
                {rx.deaf && <div className="text-xs mt-0.5" style={{ color: "#00A69D" }}>🤟 Sordo</div>}
              </div>

              {/* Paciente */}
              <div className="text-sm" style={{ color: "#374151", fontWeight: 500 }}>{rx.patient}</div>

              {/* Medicamento */}
              <div>
                <div className="flex items-center gap-1.5">
                  <Pill size={13} style={{ color: "#00A69D", flexShrink: 0 }} />
                  <span className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{rx.medicine}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{rx.dose}</div>
              </div>

              {/* Médico */}
              <div className="text-sm" style={{ color: "#6B7280" }}>{rx.doctor}</div>

              {/* Hora */}
              <div className="text-xs flex items-center gap-1" style={{ color: "#9CA3AF" }}>
                <Clock size={11} /> {rx.issuedAt}
              </div>

              {/* Acción */}
              <div className="flex justify-center">
                {rx.dispatched ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}>
                    <CheckCircle size={13} /> Despachada
                  </span>
                ) : (
                  <button
                    onClick={() => dispatch(rx.id)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs text-white transition-all"
                    style={{ background: "#00A69D", fontWeight: 600, boxShadow: "0 2px 6px rgba(0,166,157,0.25)" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
                  >
                    <CheckCircle size={13} /> Validar y Despachar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((rx) => (
          <div key={rx.id} className="bg-white rounded-xl p-4 shadow-sm" style={{ opacity: rx.dispatched ? 0.65 : 1 }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-sm" style={{ color: "#203A70", fontWeight: 700 }}>{rx.id}</span>
                {rx.urgent && !rx.dispatched && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: "#EF4444", fontWeight: 700 }}>URGENTE</span>
                )}
                <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}><Clock size={10} className="inline" /> {rx.issuedAt}</div>
              </div>
              <span className="text-sm" style={{ color: "#374151", fontWeight: 500 }}>{rx.patient}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Pill size={14} style={{ color: "#00A69D" }} />
              <span className="text-sm" style={{ color: "#203A70", fontWeight: 600 }}>{rx.medicine}</span>
            </div>
            <div className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>{rx.dose}</div>
            <div className="text-xs mb-3" style={{ color: "#6B7280" }}>{rx.doctor}</div>
            {rx.dispatched ? (
              <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs" style={{ background: "#DCFCE7", color: "#10B981", fontWeight: 600 }}>
                <CheckCircle size={13} /> Despachada
              </div>
            ) : (
              <button
                onClick={() => dispatch(rx.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm text-white"
                style={{ background: "#00A69D", fontWeight: 700 }}
              >
                <CheckCircle size={15} /> Validar y Despachar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   PEDIDOS — reabastecimiento a proveedores
════════════════════════════════════════ */
const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  borrador: { label: "Borrador", color: "#9CA3AF", bg: "#F3F4F6", icon: <FileText size={14} /> },
  enviado: { label: "Enviado al Lab.", color: "#D97706", bg: "#FEF3C7", icon: <FlaskConical size={14} /> },
  transito: { label: "En Tránsito", color: "#3B82F6", bg: "#EFF6FF", icon: <Truck size={14} /> },
  recibido: { label: "Recibido", color: "#10B981", bg: "#DCFCE7", icon: <CheckCircle size={14} /> },
};

const tabOrder: OrderStatus[] = ["borrador", "enviado", "transito", "recibido"];

function PedidosView() {
  const [orders] = useState<Order[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<OrderStatus>("transito");
  const [showModal, setShowModal] = useState(false);

  const tabCounts = tabOrder.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const filtered = orders.filter((o) => o.status === activeTab);

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Pedidos a Proveedores</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Gestión de compras y reabastecimiento · Farmacia Suiza Plus
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm transition-all"
          style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.28)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
        >
          <Plus size={16} /> Nuevo Pedido a Proveedor
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabOrder.map((s) => {
          const conf = statusConfig[s];
          const count = tabCounts[s];
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className="bg-white rounded-xl p-4 shadow-sm text-left transition-all"
              style={{
                outline: activeTab === s ? `2px solid #00A69D` : "none",
                outlineOffset: "2px",
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: conf.bg }}>
                <span style={{ color: conf.color }}>{conf.icon}</span>
              </div>
              <div style={{ color: "#203A70", fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>{count}</div>
              <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{conf.label}</div>
            </button>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "#E5E7EB" }}>
        {tabOrder.map((s) => {
          const conf = statusConfig[s];
          const active = activeTab === s;
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className="flex items-center gap-2 px-4 py-3 text-sm transition-all relative"
              style={{
                color: active ? "#203A70" : "#9CA3AF",
                fontWeight: active ? 700 : 400,
                borderBottom: active ? "2px solid #00A69D" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              <span style={{ color: active ? "#00A69D" : conf.color }}>{conf.icon}</span>
              {conf.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  background: active ? "#F0FFFE" : "#F3F4F6",
                  color: active ? "#00A69D" : "#9CA3AF",
                  fontWeight: 600,
                }}
              >
                {tabCounts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center gap-3" style={{ color: "#9CA3AF" }}>
          <Package size={40} />
          <p className="text-sm">No hay pedidos en esta categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((order) => {
            const conf = statusConfig[order.status];
            return (
              <div
                key={order.id}
                className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: "#203A70", fontWeight: 800, fontSize: "15px" }}>{order.id}</span>
                      <span
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: conf.bg, color: conf.color, fontWeight: 600 }}
                      >
                        {conf.icon} {conf.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: "#374151" }}>
                      <Building2 size={14} style={{ color: "#00A69D" }} />
                      <span style={{ fontWeight: 600 }}>{order.supplier}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div style={{ color: "#203A70", fontWeight: 800, fontSize: "18px" }}>
                      RD$ {order.total.toLocaleString("es-DO")}
                    </div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>Monto total</div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                      <Pill size={11} style={{ color: "#00A69D", flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>

                {/* Footer metadata */}
                <div
                  className="flex items-center justify-between pt-3 border-t text-xs"
                  style={{ borderColor: "#F3F4F6" }}
                >
                  <div className="flex items-center gap-3" style={{ color: "#9CA3AF" }}>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> Creado {order.createdAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck size={11} /> Entrega: {order.estimatedDelivery}
                    </span>
                  </div>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{ color: "#00A69D", border: "1px solid #00A69D", fontWeight: 600, background: "transparent" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F0FFFE")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    Ver Detalles <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Order Modal */}
      {showModal && <NewOrderModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ supplier: "", product: "", qty: "", notes: "" });

  const suppliers = ["Pfizer RD", "Distribuidora Nacional", "MediLab Caribe", "Bayer Dominicana", "Farma Insumos SRL"];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(32,58,112,0.25)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "18px" }}>Nuevo Pedido a Proveedor</h2>
          <button onClick={onClose} className="text-sm" style={{ color: "#9CA3AF" }}>✕</button>
        </div>

        {[
          {
            label: "Proveedor / Laboratorio",
            node: (
              <select
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#F9FAFB", color: "#374151" }}
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => <option key={s}>{s}</option>)}
              </select>
            ),
          },
          {
            label: "Medicamento / Producto",
            node: (
              <input
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                placeholder="Ej: Losartán 50mg"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#F9FAFB" }}
              />
            ),
          },
          {
            label: "Cantidad (unidades)",
            node: (
              <input
                type="number"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                placeholder="Ej: 500"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#F9FAFB" }}
              />
            ),
          },
          {
            label: "Notas adicionales",
            node: (
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Instrucciones especiales para el proveedor..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "#F9FAFB" }}
              />
            ),
          },
        ].map(({ label, node }) => (
          <div key={label}>
            <label className="block text-xs mb-1.5" style={{ color: "#203A70", fontWeight: 600 }}>{label}</label>
            {node}
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all"
            style={{ color: "#6B7280", border: "1px solid #E5E7EB", fontWeight: 500 }}
          >
            Cancelar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-white"
            style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.28)" }}
          >
            Guardar Borrador
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   INVENTARIO
════════════════════════════════════════ */
function InventoryView() {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"todos" | "bajo" | "agotados">("todos");

  const allItems = [
    { name: "Atorvastatina 20mg", stock: 450, min: 100, category: "Cardiovascular" },
    { name: "Metformina 500mg", stock: 820, min: 200, category: "Diabetes" },
    { name: "Losartán 50mg", stock: 65, min: 100, category: "Cardiovascular" },
    { name: "Paracetamol 500mg", stock: 1200, min: 500, category: "Analgésico" },
    { name: "Omeprazol 20mg", stock: 38, min: 100, category: "Digestivo" },
    { name: "Amoxicilina 500mg", stock: 280, min: 150, category: "Antibiótico" },
    { name: "Sertralina 50mg", stock: 0, min: 80, category: "Psiquiátrico" },
    { name: "Furosemida 40mg", stock: 95, min: 120, category: "Diurético" },
  ];

  const getStatus = (stock: number, min: number) =>
    stock === 0 ? "agotado" : stock < min ? "bajo" : "ok";

  const statusConf = {
    ok: { bg: "#DCFCE7", color: "#10B981", label: "✓ OK" },
    bajo: { bg: "#FEF3C7", color: "#D97706", label: "⚠ Stock bajo" },
    agotado: { bg: "#FEE2E2", color: "#EF4444", label: "✗ Agotado" },
  };

  const filtered = allItems.filter((item) => {
    const status = getStatus(item.stock, item.min);
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      stockFilter === "todos" ? true :
      stockFilter === "bajo" ? status === "bajo" :
      status === "agotado";
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-5 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Inventario</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1" style={{ minWidth: "200px" }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar medicamento o categoría..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none bg-white"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          />
        </div>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none bg-white"
          style={{ color: "#374151", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontWeight: 500 }}
        >
          <option value="todos">Todos</option>
          <option value="bajo">Stock bajo</option>
          <option value="agotados">Agotados</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div
          className="grid px-5 py-3 text-xs"
          style={{
            gridTemplateColumns: "1fr 100px 120px 110px 130px",
            background: "#F9FAFB",
            borderBottom: "1px solid #F3F4F6",
            color: "#9CA3AF",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>Medicamento</span>
          <span>Categoría</span>
          <span className="text-right">Stock actual</span>
          <span className="text-center">Estado</span>
          <span className="text-center">Acción</span>
        </div>
        <div className="divide-y" style={{ borderColor: "#F9FAFB" }}>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Sin resultados</div>
          ) : filtered.map((item, i) => {
            const status = getStatus(item.stock, item.min);
            const conf = statusConf[status];
            return (
              <div key={i} className="grid items-center px-5 py-3.5" style={{ gridTemplateColumns: "1fr 100px 120px 110px 130px" }}>
                <span style={{ color: "#203A70", fontWeight: 600, fontSize: "14px" }}>{item.name}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{item.category}</span>
                <span className="text-right text-sm" style={{ color: status === "ok" ? "#374151" : conf.color, fontWeight: status === "ok" ? 400 : 700 }}>
                  {item.stock} u.
                </span>
                <div className="flex justify-center">
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: conf.bg, color: conf.color, fontWeight: 600 }}>
                    {conf.label}
                  </span>
                </div>
                <div className="flex justify-center">
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{ color: "#00A69D", border: "1px solid #00A69D", fontWeight: 600, background: "transparent" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F0FFFE")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <RefreshCw size={11} /> Reabastecer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ESTADÍSTICAS
════════════════════════════════════════ */
const chartData = [
  { day: "Lun", value: 38 },
  { day: "Mar", value: 52 },
  { day: "Mié", value: 45 },
  { day: "Jue", value: 61 },
  { day: "Vie", value: 74 },
  { day: "Sáb", value: 58 },
  { day: "Dom", value: 33 },
];

function AnalyticsView() {
  const maxVal = Math.max(...chartData.map((d) => d.value));

  return (
    <div className="p-6 space-y-6 anim-fade-in">
      <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Estadísticas del Mes</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 anim-fade-in-up anim-d-1">
        {[
          { label: "Ventas del mes", value: "RD$ 12,400", change: "+14.8%", sub: "vs. junio" },
          { label: "Recetas despachadas", value: "284", change: "+22", sub: "esta semana" },
          { label: "Clientes atendidos", value: "156", change: "+8.3%", sub: "vs. mes anterior" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm">
            <div style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>{s.value}</div>
            <div className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{s.label}</div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              <span style={{ color: "#10B981", fontWeight: 700 }}>{s.change}</span>
              <span style={{ color: "#9CA3AF" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ color: "#203A70", fontWeight: 700, fontSize: "16px" }}>Flujo de Despacho</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Últimos 7 días · Recetas despachadas por día</p>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: "#9CA3AF" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#00A69D" }} />
              Despachadas
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3" style={{ height: "180px" }}>
          {chartData.map((d, i) => {
            const heightPct = (d.value / maxVal) * 100;
            const isMax = d.value === maxVal;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs" style={{ color: isMax ? "#00A69D" : "#9CA3AF", fontWeight: isMax ? 700 : 400 }}>
                  {d.value}
                </span>
                <div className="w-full flex items-end" style={{ height: "140px" }}>
                  <div
                    className="w-full rounded-t-lg"
                    style={{
                      height: `${heightPct}%`,
                      background: isMax
                        ? "linear-gradient(to top, #00A69D, #00C7C0)"
                        : "linear-gradient(to top, #00A69D33, #00C7C022)",
                      minHeight: "6px",
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: isMax ? "#203A70" : "#9CA3AF", fontWeight: isMax ? 700 : 400 }}>
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs" style={{ borderColor: "#F3F4F6" }}>
          <span style={{ color: "#9CA3AF" }}>Promedio:</span>
          <span style={{ color: "#203A70", fontWeight: 700 }}>
            {Math.round(chartData.reduce((a, b) => a + b.value, 0) / chartData.length)} recetas/día
          </span>
          <span style={{ color: "#9CA3AF" }}>
            Mejor día: <strong style={{ color: "#00A69D" }}>
              {chartData.find((d) => d.value === maxVal)?.day} ({maxVal})
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
