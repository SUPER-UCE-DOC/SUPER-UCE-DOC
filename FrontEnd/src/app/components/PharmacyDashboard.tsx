import { useState, useEffect } from "react";
import { SettingsView } from "./SettingsView";
import { api } from "../utils/api";
import {
  CheckCircle, Clock, Package, AlertCircle, Filter, Pill,
  Search, RefreshCw, Truck, FlaskConical, Plus, ChevronRight,
  FileText, MapPin, Building2, Calendar, DollarSign, Trash2
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
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todas" | "urgentes" | "despachadas">("todas");

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await api.getPrescriptions();
      const formatted = data.map((rx: any) => ({
        id: rx.id,
        patient: rx.patient_name,
        medicine: rx.medicine,
        dose: rx.dose,
        frequency: rx.frequency,
        doctor: rx.doctor_name,
        issuedAt: new Date(rx.issued_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        urgent: rx.medicine.includes("Sertralina") || rx.medicine.includes("Furosemida"),
        dispatched: rx.status === "despachada",
        deaf: rx.patient_name.includes("Rosa") || rx.patient_name.includes("María") || rx.patient_name.includes("Morales"),
      }));
      setPrescriptions(formatted);
    } catch (err) {
      console.error("Error cargando recetas en farmacia:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, []);

  const dispatch = async (id: string) => {
    try {
      await api.dispatchPrescription(id);
      setPrescriptions((prev) =>
        prev.map((rx) => (rx.id === id ? { ...rx, dispatched: true } : rx))
      );
      alert("Receta validada y despachada con éxito. Stock actualizado en base de datos (Transacción ACID).");
    } catch (err: any) {
      alert("Error al despachar receta: " + err.message);
    }
  };

  const pending = prescriptions.filter((r) => !r.dispatched).length;
  const urgent = prescriptions.filter((r) => r.urgent && !r.dispatched).length;
  const dispatched = prescriptions.filter((r) => r.dispatched).length;

  const filtered = prescriptions.filter((rx) => {
    if (filter === "urgentes") return rx.urgent && !rx.dispatched;
    if (filter === "despachadas") return rx.dispatched;
    return true;
  });

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB" }}>

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
                <div className="flex flex-col gap-0.5 mt-1.5">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dosis</div>
                  <div className="text-sm font-medium" style={{ color: "#00A69D", lineHeight: 1.2 }}>{rx.dose}</div>
                </div>
                <div className="flex flex-col gap-0.5 mt-2.5">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Frecuencia</div>
                  <div className="text-sm font-medium" style={{ color: "#00A69D", lineHeight: 1.2 }}>{rx.frequency}</div>
                </div>
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
            <div className="grid grid-cols-2 gap-2 mt-2 mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Dosis</div>
                <div className="text-xs font-medium" style={{ color: "#00A69D", lineHeight: 1.2 }}>{rx.dose}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Frecuencia</div>
                <div className="text-xs font-medium" style={{ color: "#00A69D", lineHeight: 1.2 }}>{rx.frequency}</div>
              </div>
            </div>
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderStatus>("transito");
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getSupplierOrders();
      if (Array.isArray(data)) {
        const formatted: Order[] = data.map((o: any) => ({
          id: o.id,
          supplier: o.supplier,
          items: typeof o.items === "string" ? o.items.split(",") : o.items,
          total: o.total,
          estimatedDelivery: o.estimated_delivery,
          status: o.status as OrderStatus,
          createdAt: new Date(o.created_at).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })
        }));
        setOrders(formatted);
      }
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.updateSupplierOrderStatus(orderId, newStatus);
      if (newStatus === "recibido") {
        alert(`¡Pedido ${orderId} marcado como RECIBIDO!\nLos productos han sido acreditados automáticamente al inventario de tu farmacia.`);
      }
      loadOrders();
      setSelectedOrder(null);
    } catch (err: any) {
      alert("Error al actualizar estado del pedido: " + (err.message || "Error de servidor"));
    }
  };

  const tabCounts = tabOrder.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const filtered = orders.filter((o) => o.status === activeTab);

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB" }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Pedidos a Proveedores</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Gestión de compras y reabastecimiento · Sistema Farmacéutico
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm transition-all shadow-md hover:opacity-90"
          style={{ background: "#00A69D", fontWeight: 700 }}
        >
          <Plus size={16} /> Nuevo Pedido a Proveedor
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabOrder.map((s) => {
          const conf = statusConfig[s];
          const count = tabCounts[s] || 0;
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className="bg-white rounded-xl p-4 shadow-sm text-left transition-all hover:shadow-md cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-3 text-sm transition-all relative cursor-pointer"
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
                {tabCounts[s] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
          Cargando pedidos de reabastecimiento...
        </div>
      ) : filtered.length === 0 ? (
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
                className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4 border border-gray-100 hover:border-gray-200 transition-all"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: "#203A70", fontWeight: 800, fontSize: "15px" }}>{order.id}</span>
                      <span
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: conf.bg, color: conf.color }}
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
                <div className="space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "#374151", fontWeight: 500 }}>
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
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors cursor-pointer"
                    style={{ color: "#00A69D", border: "1px solid #00A69D", background: "transparent" }}
                  >
                    Ver Detalles <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ver Detalles */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* Modal Nuevo Pedido */}
      {showModal && <NewOrderModal onClose={() => setShowModal(false)} onCreated={loadOrders} />}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onUpdateStatus }: { order: Order; onClose: () => void; onUpdateStatus: (id: string, status: OrderStatus) => void }) {
  const conf = statusConfig[order.status];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/40 backdrop-blur-sm anim-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 anim-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "18px" }}>Pedido {order.id}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: conf.bg, color: conf.color }}>
                {conf.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Proveedor: <strong>{order.supplier}</strong></p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
            <p className="font-bold text-gray-700">Productos solicitados:</p>
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                <span className="flex items-center gap-1.5">
                  <Pill size={12} className="text-[#00A69D]" /> {item}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
            <div>
              <span className="text-gray-500 block text-[11px]">Monto Total:</span>
              <span className="text-base font-extrabold text-[#203A70]">RD$ {order.total.toLocaleString("es-DO")}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">Entrega Estimada:</span>
              <span className="text-sm font-bold text-gray-700">{order.estimatedDelivery}</span>
            </div>
          </div>
        </div>

        {/* Acciones según estado */}
        <div className="space-y-2.5 pt-3 border-t">
          <p className="text-xs font-bold text-[#203A70]">Acciones disponible para este pedido:</p>
          <div className="flex flex-col gap-2">
            {order.status === "borrador" && (
              <button
                onClick={() => onUpdateStatus(order.id, "enviado")}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <FlaskConical size={15} /> 1. Enviar a Laboratorio (Cambiar a "Enviado")
              </button>
            )}
            {(order.status === "borrador" || order.status === "enviado") && (
              <button
                onClick={() => onUpdateStatus(order.id, "transito")}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Truck size={15} /> 2. Marcar como En Tránsito
              </button>
            )}
            {order.status !== "recibido" && (
              <button
                onClick={() => onUpdateStatus(order.id, "recibido")}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <CheckCircle size={15} /> 3. Marcar como Recibido y Acreditar a Inventario
              </button>
            )}
            {order.status === "recibido" && (
              <div className="w-full text-center py-3 px-4 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Pedido Recibido · Productos acreditados al inventario de la farmacia
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getFutureDateStr(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

function formatDeliveryLabel(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const formattedDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

  if (diffDays === 0) return `Hoy (${formattedDate})`;
  if (diffDays === 1) return `En 1 día (${formattedDate})`;
  if (diffDays > 1) return `En ${diffDays} días (${formattedDate})`;
  return `Entrega: ${formattedDate}`;
}

const ragMedicines = [
  { name: "Losartán 50mg", defaultPrice: 45 },
  { name: "Losartán 25mg", defaultPrice: 35 },
  { name: "Atorvastatina 20mg", defaultPrice: 60 },
  { name: "Metformina 500mg", defaultPrice: 25 },
  { name: "Metformina 850mg", defaultPrice: 35 },
  { name: "Omeprazol 20mg", defaultPrice: 30 },
  { name: "Paracetamol 500mg (Acetaminofén)", defaultPrice: 15 },
  { name: "Amoxicilina 500mg", defaultPrice: 40 },
  { name: "Amoxicilina + Ác. Clavulánico 875mg", defaultPrice: 85 },
  { name: "Azitromicina 500mg", defaultPrice: 75 },
  { name: "Ciprofloxacino 500mg", defaultPrice: 65 },
  { name: "Ibuprofeno 400mg", defaultPrice: 20 },
  { name: "Ibuprofeno 600mg", defaultPrice: 30 },
  { name: "Diclofenaco 50mg", defaultPrice: 25 },
  { name: "Enalapril 20mg", defaultPrice: 35 },
  { name: "Amlodipino 5mg", defaultPrice: 30 },
  { name: "Amlodipino 10mg", defaultPrice: 45 },
  { name: "Atenolol 50mg", defaultPrice: 25 },
  { name: "Hidroclorotiazida 25mg", defaultPrice: 20 },
  { name: "Glibenclamida 5mg", defaultPrice: 20 },
  { name: "Sertralina 50mg", defaultPrice: 70 },
  { name: "Furosemida 40mg", defaultPrice: 25 },
  { name: "Ácido Fólico 5mg", defaultPrice: 15 },
  { name: "Loratadina 10mg", defaultPrice: 20 },
  { name: "Sales de Rehidratación Oral (SRO)", defaultPrice: 10 },
];

interface OrderItemLine {
  id: string;
  product: string;
  qty: number;
  unitPrice: number;
  showSuggestions?: boolean;
}

function NewOrderModal({ onClose, onCreated, initialMed }: { onClose: () => void; onCreated: () => void; initialMed?: string }) {
  const [supplier, setSupplier] = useState("Pfizer RD");
  const [items, setItems] = useState<OrderItemLine[]>(() => {
    if (initialMed) {
      const matched = ragMedicines.find((m) => m.name.toLowerCase() === initialMed.toLowerCase());
      return [{ id: "1", product: initialMed, qty: 500, unitPrice: matched ? matched.defaultPrice : 40 }];
    }
    return [{ id: "1", product: "", qty: 100, unitPrice: 0 }];
  });
  const [deliveryDate, setDeliveryDate] = useState(() => getFutureDateStr(3));
  const [submitting, setSubmitting] = useState(false);

  const calculatedDeliveryText = formatDeliveryLabel(deliveryDate);
  const suppliers = ["Pfizer RD", "Distribuidora Nacional", "MediLab Caribe", "Bayer Dominicana", "Farma Insumos SRL"];

  // Calculate order total dynamically
  const grandTotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), product: "", qty: 100, unitPrice: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OrderItemLine, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          if (field === "product") {
            updated.showSuggestions = true;
            const matched = ragMedicines.find((m) => m.name.toLowerCase() === String(value).toLowerCase());
            if (matched) {
              updated.unitPrice = matched.defaultPrice;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSelectSuggestion = (index: number, medName: string, price: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, product: medName, unitPrice: price, showSuggestions: false } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.product.trim().length > 0);
    if (validItems.length === 0) {
      alert("Por favor registra al menos un producto o medicamento válido.");
      return;
    }
    try {
      setSubmitting(true);
      const itemStrings = validItems.map((it) => `${it.product.trim()} ×${it.qty || 100}u`);
      await api.createSupplierOrder({
        supplier: supplier,
        items: itemStrings,
        total: grandTotal,
        estimated_delivery: calculatedDeliveryText
      });
      alert("¡Nuevo pedido a proveedor registrado exitosamente!");
      onCreated();
      onClose();
    } catch (err: any) {
      alert("Error al registrar pedido: " + (err.message || "Error del servidor"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm anim-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 anim-scale-in my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "20px" }}>Nuevo Pedido a Proveedor</h2>
            <p className="text-xs text-gray-500">Selecciona medicamentos del catálogo RAG y agrega múltiples ítems.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">✕</button>
        </div>

        {/* Proveedor y Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1 font-semibold" style={{ color: "#203A70" }}>Proveedor / Laboratorio</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:border-[#00A69D] font-medium"
            >
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 font-semibold" style={{ color: "#203A70" }}>Fecha Estimada de Entrega</label>
            <input
              type="date"
              value={deliveryDate}
              min={getFutureDateStr(0)}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:border-[#00A69D] cursor-pointer font-medium text-gray-700"
            />
          </div>
        </div>

        {/* Etiqueta de entrega calculada */}
        {calculatedDeliveryText && (
          <div className="px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-100 text-xs font-semibold text-[#00A69D] flex items-center justify-between flex-wrap gap-1">
            <span className="text-gray-600">Tiempo de entrega calculado:</span>
            <span className="font-extrabold text-[#00A69D] bg-white px-2.5 py-0.5 rounded-md border border-teal-200">{calculatedDeliveryText}</span>
          </div>
        )}

        {/* Lista de Medicamentos (Líneas de Pedido) */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "#203A70" }}>
            Productos y Medicamentos a Solicitar ({items.length})
          </label>

          <div className="space-y-2.5 pr-1">
            {items.map((item, idx) => {
              const suggestions = ragMedicines.filter((m) =>
                m.name.toLowerCase().includes(item.product.toLowerCase().trim())
              );
              const subtotal = item.qty * item.unitPrice;

              return (
                <div
                  key={item.id}
                  className="relative flex items-start gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 transition-all"
                  style={{ zIndex: item.showSuggestions ? 50 : 1 }}
                >
                  {/* Campo Autocompletado Nombre Medicamento */}
                  <div className="flex-1 relative">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Medicamento / Producto</label>
                    <input
                      type="text"
                      value={item.product}
                      onFocus={() => handleItemChange(idx, "showSuggestions", true)}
                      onBlur={() => setTimeout(() => handleItemChange(idx, "showSuggestions", false), 150)}
                      onChange={(e) => handleItemChange(idx, "product", e.target.value)}
                      placeholder="Ej: Losartán 50mg, Omeprazol 20mg..."
                      className="w-full px-3 py-2 rounded-lg text-xs border outline-none bg-white focus:border-[#00A69D]"
                      required
                    />

                    {/* Autocomplete Suggestions Dropdown Floating Above */}
                    {item.showSuggestions && item.product.trim().length > 0 && suggestions.length > 0 && (
                      <div
                        className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#00A69D] rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-gray-100"
                        style={{ zIndex: 9999 }}
                      >
                        {suggestions.map((sug) => (
                          <button
                            key={sug.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestion(idx, sug.name, sug.defaultPrice);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 text-xs flex items-center justify-between text-gray-700 transition-colors cursor-pointer"
                          >
                            <span className="font-semibold text-[#203A70] flex items-center gap-1.5">
                              <Pill size={13} className="text-[#00A69D]" /> {sug.name}
                            </span>
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                              RD$ {sug.defaultPrice}/u
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cantidad (unidades) */}
                  <div className="w-24">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Unidades</label>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, "qty", parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none bg-white focus:border-[#00A69D] text-center font-bold text-gray-800"
                    />
                  </div>

                  {/* Precio Unitario */}
                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Precio Unit. (RD$)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none bg-white focus:border-[#00A69D] text-center font-bold text-gray-800"
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="w-28 text-right self-center pt-4">
                    <span className="text-[10px] text-gray-400 block">Subtotal:</span>
                    <span className="text-xs font-extrabold text-[#203A70]">RD$ {subtotal.toLocaleString("es-DO")}</span>
                  </div>

                  {/* Botón eliminar línea */}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="mt-5 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar este producto"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2.5 rounded-xl border border-dashed border-[#00A69D] text-[#00A69D] hover:bg-teal-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={15} /> Agregar otro medicamento al pedido
          </button>
        </div>

        {/* Resumen Total Estimado */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#203A70] text-white shadow-inner">
          <div>
            <span className="text-xs text-gray-300 block">Monto Total Calculado ({items.length} productos):</span>
            <span className="text-xs text-teal-300">Sumatoria automática de líneas de pedido</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-extrabold text-[#00C7C0]">
              RD$ {grandTotal.toLocaleString("es-DO")}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
            style={{ background: "#00A69D" }}
          >
            {submitting ? "Guardar..." : "Guardar Borrador del Pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ════════════════════════════════════════
   INVENTARIO
════════════════════════════════════════ */
const getCategoryForMedicine = (med: string) => {
  const m = med.toLowerCase();
  if (m.includes("amoxicilina") || m.includes("azitromicina") || m.includes("ciprofloxacino")) return "Antibiótico";
  if (m.includes("losartán") || m.includes("atorvastatina") || m.includes("enalapril") || m.includes("amlodipino") || m.includes("atenolol") || m.includes("furosemida") || m.includes("hidroclorotiazida")) return "Cardiovascular";
  if (m.includes("paracetamol") || m.includes("ibuprofeno") || m.includes("diclofenaco") || m.includes("acetaminofén")) return "Analgésico";
  if (m.includes("metformina") || m.includes("glibenclamida") || m.includes("insulina")) return "Diabetes";
  if (m.includes("omeprazol") || m.includes("rehidratación")) return "Digestivo";
  if (m.includes("sertralina")) return "Psiquiátrico";
  return "General";
};

function InventoryView() {
  const [items, setItems] = useState<{ id: number; medicine: string; stock: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"todos" | "bajo" | "agotados">("todos");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [reorderMed, setReorderMed] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const me = await api.getMe();
      if (me && me.id) {
        const data = await api.getInventory(me.id);
        setItems(data || []);
      }
    } catch (err) {
      console.error("Error cargando inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const getStatus = (stock: number) =>
    stock === 0 ? "agotado" : stock < 100 ? "bajo" : "ok";

  const statusConf = {
    ok: { bg: "#DCFCE7", color: "#10B981", label: "✓ OK" },
    bajo: { bg: "#FEF3C7", color: "#D97706", label: "⚠ Stock bajo" },
    agotado: { bg: "#FEE2E2", color: "#EF4444", label: "✗ Agotado" },
  };

  const filtered = items.filter((item) => {
    const status = getStatus(item.stock);
    const cat = getCategoryForMedicine(item.medicine);
    const matchSearch = item.medicine.toLowerCase().includes(search.toLowerCase()) || cat.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      stockFilter === "todos" ? true :
      stockFilter === "bajo" ? status === "bajo" :
      status === "agotado";
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6 space-y-5 anim-fade-in" style={{ background: "#F9FAFB" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 anim-fade-in-up anim-d-0">
        <div>
          <h1 style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Inventario</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Control de stock en tiempo real · Farmacia Suiza Plus
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm transition-all cursor-pointer"
          style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.28)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
        >
          <Plus size={16} /> Registrar Medicamento Manualmente
        </button>
      </div>

      {/* Controles de Búsqueda y Filtro */}
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
          <option value="todos">Todos los estados</option>
          <option value="bajo">Stock bajo</option>
          <option value="agotados">Agotados</option>
        </select>
      </div>

      {/* Tabla de Inventario */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: "1px solid #F3F4F6" }}>
        <div
          className="grid px-5 py-3 text-xs"
          style={{
            gridTemplateColumns: "1fr 120px 120px 110px 130px",
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
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: "#9CA3AF" }}>Cargando inventario...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3" style={{ color: "#9CA3AF" }}>
              <Package size={44} style={{ color: "#D1D5DB" }} />
              <p className="text-base" style={{ color: "#203A70", fontWeight: 800 }}>Inventario Vacío</p>
              <p className="text-xs max-w-sm text-center" style={{ color: "#9CA3AF" }}>
                No hay medicamentos en el inventario. Haz un pedido a proveedores para reabastecer o registra inventario manualmente.
              </p>
              <button
                onClick={() => setShowOrderModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm transition-all cursor-pointer mt-1"
                style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.28)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008f87")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
              >
                <Plus size={16} /> Hacer Pedido a Proveedor
              </button>
            </div>
          ) : (
            filtered.map((item) => {
              const status = getStatus(item.stock);
              const conf = statusConf[status];
              const category = getCategoryForMedicine(item.medicine);
              return (
                <div key={item.id} className="grid items-center px-5 py-3.5" style={{ gridTemplateColumns: "1fr 120px 120px 110px 130px" }}>
                  <span style={{ color: "#203A70", fontWeight: 600, fontSize: "14px" }}>{item.medicine}</span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{category}</span>
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
                      onClick={() => setReorderMed(item.medicine)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                      style={{ color: "#00A69D", border: "1px solid #00A69D", fontWeight: 600, background: "transparent" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F0FFFE")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    >
                      <RefreshCw size={11} /> Reabastecer
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Registrar Medicamento Manualmente */}
      {showAddModal && (
        <AddInventoryItemModal
          onClose={() => setShowAddModal(false)}
          onAdded={loadInventory}
        />
      )}

      {/* Modal Hacer Pedido a Proveedor */}
      {showOrderModal && (
        <NewOrderModal
          onClose={() => setShowOrderModal(false)}
          onCreated={loadInventory}
        />
      )}

      {/* Modal Reabastecer Medicamento Específico */}
      {reorderMed && (
        <NewOrderModal
          onClose={() => setReorderMed(null)}
          onCreated={loadInventory}
          initialMed={reorderMed}
        />
      )}
    </div>
  );
}

function AddInventoryItemModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [medicine, setMedicine] = useState("");
  const [stock, setStock] = useState("100");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = ragMedicines.filter((m) =>
    m.name.toLowerCase().includes(medicine.toLowerCase().trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicine.trim()) {
      alert("Por favor escribe el nombre del medicamento.");
      return;
    }
    try {
      setSubmitting(true);
      await api.updateInventoryItem(medicine.trim(), parseInt(stock) || 0);
      alert(`¡Medicamento "${medicine.trim()}" registrado en el inventario con ${stock} unidades!`);
      onAdded();
      onClose();
    } catch (err: any) {
      alert("Error al actualizar inventario: " + (err.message || "Error del servidor"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm anim-fade-in" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 style={{ color: "#203A70", fontWeight: 800, fontSize: "18px" }}>Agregar a Inventario</h2>
            <p className="text-xs text-gray-500">Registro directo de medicamento y stock en farmacia.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="relative">
          <label className="block text-xs mb-1 font-semibold" style={{ color: "#203A70" }}>Medicamento / Producto</label>
          <input
            type="text"
            value={medicine}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onChange={(e) => { setMedicine(e.target.value); setShowSuggestions(true); }}
            placeholder="Ej: Losartán 50mg, Metformina 500mg..."
            className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:border-[#00A69D]"
            required
          />

          {showSuggestions && medicine.trim().length > 0 && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#00A69D] rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-gray-100 z-50">
              {suggestions.map((sug) => (
                <button
                  key={sug.name}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMedicine(sug.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-teal-50 text-xs flex items-center justify-between text-gray-700 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-[#203A70] flex items-center gap-1.5">
                    <Pill size={13} className="text-[#00A69D]" /> {sug.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1 font-semibold" style={{ color: "#203A70" }}>Stock Inicial (unidades)</label>
          <input
            type="number"
            min="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:border-[#00A69D]"
            required
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer"
            style={{ background: "#00A69D" }}
          >
            {submitting ? "Guardando..." : "Guardar en Inventario"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AnalyticsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await api.getPharmacyStats();
        setStats(data);
      } catch (err) {
        console.error("Error al cargar estadísticas:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const flowData = stats?.weekly_flow || [
    { day: "Lun", value: 0 },
    { day: "Mar", value: 0 },
    { day: "Mié", value: 0 },
    { day: "Jue", value: 0 },
    { day: "Vie", value: 0 },
    { day: "Sáb", value: 0 },
    { day: "Dom", value: 0 },
  ];

  const maxVal = Math.max(...flowData.map((d: any) => d.value), 1);
  const totalFlowSum = flowData.reduce((a: number, b: any) => a + b.value, 0);
  const avgFlow = Math.round(totalFlowSum / flowData.length);
  const peakDay = flowData.find((d: any) => d.value === maxVal);

  return (
    <div className="p-6 space-y-6 anim-fade-in" style={{ background: "#F9FAFB" }}>
      <div>
        <h1 className="anim-fade-in-up anim-d-0" style={{ color: "#203A70", fontSize: "24px", fontWeight: 800 }}>Estadísticas del Mes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas reales calculadas en tiempo real para tu farmacia.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando estadísticas en tiempo real...</div>
      ) : (
        <>
          {/* Tarjetas Métricas Superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 anim-fade-in-up anim-d-1">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>
                RD$ {(stats?.total_spent || 0).toLocaleString("es-DO")}
              </div>
              <div className="text-sm mt-0.5 font-semibold text-gray-600">Compras a Proveedores</div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span style={{ color: "#00A69D", fontWeight: 700 }}>{stats?.total_orders_count || 0} pedidos</span>
                <span style={{ color: "#9CA3AF" }}>registrados</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>
                {stats?.dispatched_prescriptions || 0}
              </div>
              <div className="text-sm mt-0.5 font-semibold text-gray-600">Recetas Despachadas</div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span style={{ color: "#10B981", fontWeight: 700 }}>✓ En plataforma</span>
                <span style={{ color: "#9CA3AF" }}>completadas</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div style={{ color: "#203A70", fontSize: "26px", fontWeight: 800 }}>
                {(stats?.total_stock_units || 0).toLocaleString("es-DO")} u.
              </div>
              <div className="text-sm mt-0.5 font-semibold text-gray-600">Inventario Disponible</div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span style={{ color: "#00A69D", fontWeight: 700 }}>{stats?.total_inventory_products || 0} productos</span>
                <span style={{ color: "#9CA3AF" }}>en catálogo</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Flujo Semanal */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ color: "#203A70", fontWeight: 700, fontSize: "16px" }}>Flujo de Actividad Semanal</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Últimos 7 días · Pedidos y despachos por día</p>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "#9CA3AF" }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#00A69D" }} />
                  Actividad
                </div>
              </div>
            </div>

            <div className="flex items-end gap-3" style={{ height: "180px" }}>
              {flowData.map((d: any, i: number) => {
                const heightPct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                const isMax = d.value === maxVal && d.value > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: isMax ? "#00A69D" : "#9CA3AF" }}>
                      {d.value}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "140px" }}>
                      <div
                        className="w-full rounded-t-lg transition-all duration-300"
                        style={{
                          height: `${Math.max(heightPct, 8)}%`,
                          background: isMax
                            ? "linear-gradient(to top, #00A69D, #00C7C0)"
                            : "linear-gradient(to top, #00A69D33, #00C7C022)",
                          minHeight: "8px",
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: isMax ? "#203A70" : "#9CA3AF" }}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs" style={{ borderColor: "#F3F4F6" }}>
              <span style={{ color: "#9CA3AF" }}>Promedio semanal:</span>
              <span style={{ color: "#203A70", fontWeight: 700 }}>
                {avgFlow} operaciones/día
              </span>
              <span style={{ color: "#9CA3AF" }}>
                Día con mayor actividad: <strong style={{ color: "#00A69D" }}>
                  {peakDay?.value > 0 ? `${peakDay.day} (${peakDay.value})` : "Sin registros este periodo"}
                </strong>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
