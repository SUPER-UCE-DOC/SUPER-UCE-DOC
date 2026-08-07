import { useState, useEffect } from "react";
import { ArrowLeft, Search, MapPin, Navigation, Clock, Phone, CheckCircle, XCircle } from "lucide-react";
import { api } from "../utils/api";
import { Map, AdvancedMarker, APIProvider } from "@vis.gl/react-google-maps";

interface FarmaciasMapaViewProps {
  medicine: string;
  prescriptionId: string;
  onBack: () => void;
}

export function FarmaciasMapaView({ medicine, prescriptionId, onBack }: FarmaciasMapaViewProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pharmaciesList, setPharmaciesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  
  const userLat = 18.463;
  const userLon = -69.304;

  useEffect(() => {
    async function loadNearby() {
      try {
        setLoading(true);
        const data = await api.getNearbyPharmacies(userLat, userLon, medicine);
        const formatted = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          distance: `${p.distance} km`,
          open: true, // Mock for now
          hasStock: p.has_stock,
          phone: p.phone,
          hours: "08:00 – 22:00",
          lat: p.lat,
          lon: p.lon,
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

  const handleAssign = async () => {
    if (!selected || !prescriptionId) return;
    try {
      setAssigning(true);
      await api.assignPrescription(prescriptionId, selected);
      setAssigned(true);
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err) {
      console.error("Error asignando receta", err);
      alert("Hubo un error al enviar la receta a la farmacia.");
    } finally {
      setAssigning(false);
    }
  };

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
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#9CA3AF" }}>
                      <Navigation size={11} />
                      {pharmacy.distance}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="flex flex-col items-center py-10 gap-3" style={{ color: "#9CA3AF" }}>
                <Search size={32} />
                <p className="text-sm">Sin resultados para "{search}"</p>
              </div>
            )}
            {loading && (
              <div className="flex justify-center p-8 text-sm" style={{ color: "#9CA3AF" }}>
                Cargando farmacias...
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
            <APIProvider apiKey={(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ""}>
              <Map
                defaultZoom={13}
                defaultCenter={{ lat: userLat, lng: userLon }}
                mapId="SUPER_UCE_DOC_MAP"
                disableDefaultUI={false}
              >
                {/* Marcador del Paciente */}
                <AdvancedMarker position={{ lat: userLat, lng: userLon }} zIndex={50}>
                  <div
                    className="flex items-center justify-center rounded-full shadow-lg"
                    style={{ background: "#203A70", border: "3px solid white", width: "40px", height: "40px" }}
                  >
                    <span style={{ fontSize: "18px" }}>👤</span>
                  </div>
                </AdvancedMarker>

                {/* Marcadores de Farmacias */}
                {pharmaciesList.map((p) => (
                  <AdvancedMarker
                    key={p.id}
                    position={{ lat: p.lat, lng: p.lon }}
                    zIndex={selected === p.id ? 100 : 10}
                    onClick={() => setSelected(p.id)}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="flex items-center justify-center rounded-full shadow-md transition-all cursor-pointer"
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
                      {selected === p.id && (
                        <div
                          className="text-xs px-2 py-0.5 rounded-lg mt-1 whitespace-nowrap"
                          style={{
                            background: "#203A70",
                            color: "white",
                            fontWeight: 600,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                          }}
                        >
                          {p.name}
                        </div>
                      )}
                    </div>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
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
                  <Clock size={12} style={{ color: "#00A69D" }} />
                  {selectedPharmacy.hours}
                </div>
                <div className="col-span-2 flex items-center gap-1.5 mt-1" style={{ color: "#6B7280" }}>
                  <Phone size={12} style={{ color: "#00A69D" }} />
                  {selectedPharmacy.phone}
                </div>
              </div>

              {assigned ? (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm" style={{ background: "#10B981", fontWeight: 700 }}>
                  <CheckCircle size={15} />
                  Receta Enviada
                </div>
              ) : (
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.3)" }}
                >
                  <Navigation size={15} />
                  {assigning ? "Enviando..." : "Enviar receta a esta farmacia"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
