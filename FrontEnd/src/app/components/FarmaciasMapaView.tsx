import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search, MapPin, Navigation, Clock, Phone } from "lucide-react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  lat: number;
  lon: number;
}

interface FarmaciasMapaViewProps {
  medicine: string;
  onBack: () => void;
}

const DEFAULT_COORDS = { lat: 18.463, lon: -69.304 };

export function FarmaciasMapaView({ medicine, onBack }: FarmaciasMapaViewProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pharmaciesList, setPharmaciesList] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>(DEFAULT_COORDS);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    async function loadNearby() {
      setLoading(true);
      setErrorMessage(null);
      let lat = DEFAULT_COORDS.lat;
      let lon = DEFAULT_COORDS.lon;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocalización no disponible"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        setUserLocation({ lat, lon });
      } catch (err) {
        console.warn("No se pudo obtener la ubicación del navegador, usando ubicación por defecto", err);
        setErrorMessage("No se pudo obtener tu ubicación. Mostrando resultados cerca de San Pedro de Macorís.");
        setUserLocation(DEFAULT_COORDS);
      }

      try {
        const data = await api.getNearbyPharmacies(lat, lon, medicine);
        const formatted = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          distance: `${p.distance} km`,
          open: true,
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
        setErrorMessage("Error al buscar farmacias cercanas. Intenta nuevamente más tarde.");
      } finally {
        setLoading(false);
      }
    }

    loadNearby();
  }, [medicine]);

  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lon], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    const markerLayer = markerLayerRef.current;

    if (!map || !markerLayer) {
      return;
    }

    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lon], 13);
    }

    markerLayer.clearLayers();

    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lon], {
        radius: 10,
        color: "#203A70",
        fillColor: "#203A70",
        fillOpacity: 1,
        weight: 2,
      }).addTo(markerLayer);

      L.marker([userLocation.lat, userLocation.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#203A70;border-radius:999px;color:white;font-size:12px;padding:6px 10px;box-shadow:0 1px 6px rgba(0,0,0,0.18);">Tu ubicación</div>`,
          iconSize: [0, 0],
        }),
      }).addTo(markerLayer);
    }

    pharmaciesList.forEach((pharmacy) => {
      const isSelected = selected === pharmacy.id;
      const marker = L.circleMarker([pharmacy.lat, pharmacy.lon], {
        radius: isSelected ? 12 : 9,
        color: pharmacy.hasStock ? "#00A69D" : "#9CA3AF",
        fillColor: pharmacy.hasStock ? "#00A69D" : "#9CA3AF",
        fillOpacity: 1,
        weight: 2,
        opacity: 1,
      }).addTo(markerLayer);

      marker.on("click", () => {
        setSelected(pharmacy.id);
      });

      marker.bindTooltip(pharmacy.name, {
        direction: "top",
        offset: [0, -10],
        className: "text-xs font-semibold",
        permanent: false,
      });

      if (isSelected) {
        marker.setStyle({ radius: 14, weight: 3 });
      }
    });
  }, [pharmaciesList, selected, userLocation]);

  const filtered = pharmaciesList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPharmacy = pharmaciesList.find((p) => p.id === selected);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F9FAFB" }}>
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

      <div className="flex flex-1 gap-0 overflow-hidden">
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
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: pharmacy.open ? "#10B981" : "#9CA3AF" }}
                      />
                      <span className="text-xs" style={{ color: pharmacy.open ? "#10B981" : "#9CA3AF", fontWeight: 600 }}>
                        {pharmacy.open ? "Abierto" : "Cerrado"}
                      </span>
                    </div>
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

        <div className="flex-1 relative overflow-hidden p-4 anim-slide-right anim-d-1">
          <div
            className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}
          >
            <div ref={mapContainerRef} className="w-full h-full" />

            <div className="absolute inset-x-6 top-6">
              {loading && (
                <div
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm"
                  style={{ background: "rgba(255,255,255,0.95)", color: "#203A70", fontWeight: 700, boxShadow: "0 1px 6px rgba(0,0,0,0.10)" }}
                >
                  Cargando farmacias...
                </div>
              )}
              {errorMessage && (
                <div
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 mt-3 text-sm"
                  style={{ background: "rgba(254,243,199,0.95)", color: "#b45309", fontWeight: 600, boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}
                >
                  {errorMessage}
                </div>
              )}
            </div>

            <div
              className="absolute bottom-3 left-3 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.90)", color: "#9CA3AF", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
            >
              📍 San Pedro de Macorís, República Dominicana
            </div>
          </div>

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
