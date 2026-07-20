import { useState, useEffect } from "react";
import { ArrowLeft, Search, MapPin, Navigation, Clock, CheckCircle, XCircle, Phone } from "lucide-react";
import { api } from "../utils/api";

interface Pharmacy {
  id: number;
  name: string;
  address: string;
  distance: string;
  open: boolean;
  hasStock: boolean;
  phone: string;
  hours: string;
  x: number; // % position on map
  y: number;
}

const pharmacies: Pharmacy[] = [
  { id: 1, name: "Farmacia Carol", address: "Av. Circunvalación #14, San Pedro de Macorís", distance: "0.4 km", open: true, hasStock: true, phone: "809-246-0011", hours: "07:00 – 22:00", x: 38, y: 42 },
  { id: 2, name: "Farmacia San Juan", address: "C/ Duarte #87, esq. Pedro A. Lluberes", distance: "0.9 km", open: true, hasStock: true, phone: "809-529-3344", hours: "08:00 – 21:00", x: 55, y: 28 },
  { id: 3, name: "Farmacia Central SPM", address: "C/ Independencia #203, San Pedro de Macorís", distance: "1.2 km", open: true, hasStock: false, phone: "809-246-7720", hours: "24 horas", x: 66, y: 55 },
  { id: 4, name: "Farmacia La Milagrosa", address: "Av. Mella #45, Barrio Los Maestros", distance: "1.7 km", open: false, hasStock: false, phone: "809-529-8801", hours: "08:00 – 20:00", x: 28, y: 65 },
  { id: 5, name: "Farmacia Suiza Plus", address: "C/ Sánchez #12, Sector El Café", distance: "2.1 km", open: true, hasStock: true, phone: "809-246-5599", hours: "07:30 – 23:00", x: 72, y: 38 },
  { id: 6, name: "Farmacia El Buen Precio", address: "Av. Charles de Gaulle #310, SPM", distance: "2.6 km", open: true, hasStock: true, phone: "809-529-1122", hours: "08:00 – 22:00", x: 48, y: 72 },
];

interface FarmaciasMapaViewProps {
  medicine: string;
  onBack: () => void;
}

export function FarmaciasMapaView({ medicine, onBack }: FarmaciasMapaViewProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pharmaciesList, setPharmaciesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNearby() {
      try {
        setLoading(true);
        // Usar coordenadas por defecto del paciente en SPM
        const lat = 18.463;
        const lon = -69.304;
        const data = await api.getNearbyPharmacies(lat, lon, medicine);
        const formatted = data.map((p: any, idx: number) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          distance: `${p.distance} km`,
          open: true,
          hasStock: p.has_stock,
          phone: p.phone,
          hours: "08:00 – 22:00",
          x: 25 + (idx * 18) % 55,
          y: 30 + (idx * 14) % 45,
        }));
        setPharmaciesList(formatted);
        if (formatted.length > 0) {
          setSelected(formatted[0].id);
        }
      } catch (err) {
        console.error("Error al buscar farmacias:", err);
      } finally {
        setLoading(false);
      }
    }
    loadNearby();
  }, [medicine]);

  const filtered = pharmaciesList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPharmacy = pharmaciesList.find((p) => p.id === selected);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F9FAFB" }}>

      {/* ── Breadcrumb / Back ── */}
      <div
        className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0"
        style={{ background: "white", borderColor: "#E5E7EB" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 transition-all"
          style={{ color: "#9CA3AF", fontWeight: 500, background: "none", border: "none", padding: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#203A70")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#9CA3AF")}
        >
          <ArrowLeft size={16} />
          Volver a Mis Recetas
        </button>
        <div className="h-5 w-px" style={{ background: "#E5E7EB" }} />
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: "#00A69D" }} />
          <span className="text-sm" style={{ color: "#6B7280" }}>Buscando farmacias con:</span>
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: "#F0FFFE", color: "#203A70", fontWeight: 700, border: "1px solid #00C7C0" }}
          >
            {medicine}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "#9CA3AF" }}>
          <MapPin size={13} style={{ color: "#00A69D" }} />
          San Pedro de Macorís, RD
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── LEFT PANEL (35%) ── */}
        <div
          className="flex flex-col border-r flex-shrink-0 anim-slide-left anim-d-0"
          style={{ width: "35%", borderColor: "#E5E7EB", background: "white" }}
        >
          {/* Search */}
          <div className="p-4 border-b" style={{ borderColor: "#F3F4F6" }}>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar farmacia por nombre..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "#F9FAFB", color: "#374151" }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>
              {filtered.filter((p) => p.hasStock).length} farmacias con stock disponible
            </p>
          </div>

          {/* Pharmacy list */}
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "#F9FAFB" }}>
            {filtered.map((pharmacy) => (
              <button
                key={pharmacy.id}
                onClick={() => setSelected(pharmacy.id)}
                className="w-full text-left p-4 transition-all"
                style={{
                  background: selected === pharmacy.id ? "#F0FFFE" : "white",
                  borderLeft: selected === pharmacy.id ? "3px solid #00A69D" : "3px solid transparent",
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className="text-sm leading-tight"
                    style={{ color: "#203A70", fontWeight: 700 }}
                  >
                    {pharmacy.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: pharmacy.hasStock ? "#DCFCE7" : "#F3F4F6",
                      color: pharmacy.hasStock ? "#10B981" : "#9CA3AF",
                      fontWeight: 600,
                    }}
                  >
                    {pharmacy.hasStock ? "✓ En stock" : "Sin stock"}
                  </span>
                </div>

                <p className="text-xs mb-2 leading-snug" style={{ color: "#6B7280" }}>
                  {pharmacy.address}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Open/closed */}
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: pharmacy.open ? "#10B981" : "#9CA3AF" }}
                      />
                      <span className="text-xs" style={{ color: pharmacy.open ? "#10B981" : "#9CA3AF", fontWeight: 600 }}>
                        {pharmacy.open ? "Abierto" : "Cerrado"}
                      </span>
                    </div>
                    {/* Distance */}
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#9CA3AF" }}>
                      <Navigation size={11} />
                      {pharmacy.distance}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected(pharmacy.id); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{
                      background: selected === pharmacy.id ? "#00A69D" : "#F3F4F6",
                      color: selected === pharmacy.id ? "white" : "#203A70",
                      fontWeight: 600,
                    }}
                  >
                    <Navigation size={11} />
                    Ver Ruta
                  </button>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-3" style={{ color: "#9CA3AF" }}>
                <Search size={32} />
                <p className="text-sm">Sin resultados para "{search}"</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — MAP (65%) ── */}
        <div className="flex-1 relative overflow-hidden p-4 anim-slide-right anim-d-1">
          <div
            className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}
          >
            {/* Map background — simulated street grid */}
            <MapBackground />

            {/* Pharmacy markers */}
            {pharmacies.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="absolute flex flex-col items-center transition-all"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)", zIndex: selected === p.id ? 20 : 10 }}
              >
                {/* Pin */}
                <div
                  className="flex items-center justify-center rounded-full shadow-md transition-all"
                  style={{
                    width: selected === p.id ? "38px" : "30px",
                    height: selected === p.id ? "38px" : "30px",
                    background: p.hasStock ? (selected === p.id ? "#00A69D" : "white") : "#9CA3AF",
                    border: `2px solid ${p.hasStock ? "#00A69D" : "#9CA3AF"}`,
                  }}
                >
                  <MapPin
                    size={selected === p.id ? 18 : 14}
                    color={p.hasStock ? (selected === p.id ? "white" : "#00A69D") : "white"}
                  />
                </div>
                {/* Label */}
                <div
                  className="text-xs px-2 py-0.5 rounded-lg mt-1 whitespace-nowrap"
                  style={{
                    background: selected === p.id ? "#203A70" : "rgba(255,255,255,0.95)",
                    color: selected === p.id ? "white" : "#374151",
                    fontWeight: 600,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                    display: selected === p.id ? "block" : "none",
                  }}
                >
                  {p.name}
                </div>
              </button>
            ))}

            {/* Patient location pin */}
            <div
              className="absolute flex flex-col items-center"
              style={{ left: "50%", top: "52%", transform: "translate(-50%, -100%)", zIndex: 30 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: "#203A70", border: "3px solid white" }}
              >
                <span style={{ fontSize: "16px" }}>👤</span>
              </div>
              <div
                className="text-xs px-2 py-0.5 rounded-lg mt-1"
                style={{ background: "#203A70", color: "white", fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
              >
                Tu ubicación
              </div>
            </div>

            {/* Map attribution pill */}
            <div
              className="absolute bottom-3 left-3 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.90)", color: "#9CA3AF", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
            >
              📍 San Pedro de Macorís, República Dominicana
            </div>
          </div>

          {/* Selected pharmacy detail card — floats over map bottom-right */}
          {selectedPharmacy && (
            <div
              className="absolute bottom-8 right-8 rounded-2xl p-5 anim-scale-in"
              style={{
                background: "white",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                minWidth: "280px",
                maxWidth: "320px",
                zIndex: 40,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p style={{ color: "#203A70", fontWeight: 800, fontSize: "15px", lineHeight: 1.3 }}>
                    {selectedPharmacy.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{selectedPharmacy.address}</p>
                </div>
                <span
                  className="flex-shrink-0 px-2 py-1 rounded-lg text-xs"
                  style={{
                    background: selectedPharmacy.hasStock ? "#DCFCE7" : "#FEE2E2",
                    color: selectedPharmacy.hasStock ? "#10B981" : "#EF4444",
                    fontWeight: 700,
                  }}
                >
                  {selectedPharmacy.hasStock ? "✓ En stock" : "✗ Sin stock"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <div className="flex items-center gap-1.5" style={{ color: "#6B7280" }}>
                  <Navigation size={12} style={{ color: "#00A69D" }} />
                  {selectedPharmacy.distance} de distancia
                </div>
                <div className="flex items-center gap-1.5" style={{ color: "#6B7280" }}>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: selectedPharmacy.open ? "#10B981" : "#9CA3AF" }}
                  />
                  {selectedPharmacy.open ? "Abierto ahora" : "Cerrado"}
                </div>
                <div className="flex items-center gap-1.5" style={{ color: "#6B7280" }}>
                  <Clock size={12} style={{ color: "#00A69D" }} />
                  {selectedPharmacy.hours}
                </div>
                <div className="flex items-center gap-1.5" style={{ color: "#6B7280" }}>
                  <Phone size={12} style={{ color: "#00A69D" }} />
                  {selectedPharmacy.phone}
                </div>
              </div>

              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm"
                style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.3)" }}
              >
                <Navigation size={15} />
                Obtener Ruta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Simulated map background with street grid ── */
function MapBackground() {
  return (
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, background: "#e8ede9" }}
    >
      {/* Base fill */}
      <rect width="100%" height="100%" fill="#e8ede9" />

      {/* Large blocks (manzanas) */}
      {[0, 1, 2, 3, 4, 5].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => (
          <rect
            key={`b-${row}-${col}`}
            x={col * 14 + 2 + "%"}
            y={row * 16 + 3 + "%"}
            width="11%"
            height="13%"
            rx="3"
            fill="#dce3dd"
            opacity="0.7"
          />
        ))
      )}

      {/* Horizontal roads */}
      {[0, 16, 32, 48, 64, 80, 96].map((y) => (
        <rect key={`h-${y}`} x="0" y={`${y}%`} width="100%" height="3%" fill="#f5f5ef" />
      ))}

      {/* Vertical roads */}
      {[0, 14, 28, 42, 56, 70, 84, 98].map((x) => (
        <rect key={`v-${x}`} x={`${x}%`} y="0" width="2.5%" height="100%" fill="#f5f5ef" />
      ))}

      {/* Parks / green areas */}
      <rect x="18%" y="20%" width="8%" height="9%" rx="4" fill="#c8dbc9" opacity="0.8" />
      <rect x="60%" y="58%" width="10%" height="7%" rx="4" fill="#c8dbc9" opacity="0.8" />

      {/* Water body */}
      <rect x="0" y="84%" width="30%" height="16%" rx="0" fill="#b8d4e8" opacity="0.6" />
      <rect x="75%" y="0" width="25%" height="18%" rx="0" fill="#b8d4e8" opacity="0.4" />

      {/* Center ring (radial reference) */}
      <circle cx="50%" cy="52%" r="12%" fill="none" stroke="#d0d8d2" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
      <circle cx="50%" cy="52%" r="22%" fill="none" stroke="#d0d8d2" strokeWidth="0.8" strokeDasharray="6 6" opacity="0.4" />
    </svg>
  );
}
