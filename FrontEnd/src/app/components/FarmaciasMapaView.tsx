import { useState, useEffect } from "react";
import { ArrowLeft, Search, MapPin, Navigation, Clock, Phone, CheckCircle, XCircle, Building2 } from "lucide-react";
import { api } from "../utils/api";
import { Map, Marker, APIProvider } from "@vis.gl/react-google-maps";

interface FarmaciasMapaViewProps {
  medicine: string;
  prescriptionId: string;
  onBack: () => void;
}

export function FarmaciasMapaView({ medicine, prescriptionId, onBack }: FarmaciasMapaViewProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [selected]);
  const [pharmaciesList, setPharmaciesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  
  const [userLat, setUserLat] = useState(18.463);
  const [userLon, setUserLon] = useState(-69.304);
  const [locationLoaded, setLocationLoaded] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLat(position.coords.latitude);
          setUserLon(position.coords.longitude);
          setLocationLoaded(true);
        },
        (error) => {
          setLocationLoaded(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!locationLoaded) return;
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
          googlePlaceId: p.google_place_id,
        })).filter((p: any) => p.hasStock);
        
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
  }, [medicine, locationLoaded, userLat, userLon]);

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

  const [placePhotoUrl, setPlacePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    setImgError(false);
    setPlacePhotoUrl(null);
    if (selectedPharmacy && selectedPharmacy.googlePlaceId) {
      const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "";
      if (!apiKey) return;
      
      fetch(`https://places.googleapis.com/v1/places/${selectedPharmacy.googlePlaceId}?fields=photos&key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.photos && data.photos.length > 0) {
            const photoName = data.photos[0].name;
            setImgError(false);
            setPlacePhotoUrl(`https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=600&maxWidthPx=600&key=${apiKey}`);
          }
        })
        .catch(err => {
          console.error("Error fetching place photo:", err);
        });
    }
  }, [selected, pharmaciesList]);

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
        {/* ── LEFT PANEL (28%) ── */}
        <div
          className="flex flex-col border-r flex-shrink-0 anim-slide-left anim-d-0"
          style={{ width: "28%", minWidth: "300px", borderColor: "#E5E7EB", background: "white" }}
        >
          <div className="p-4 border-b" style={{ borderColor: "#F3F4F6" }}>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar farmacia por nombre..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all focus:border-[#00A69D]"
                style={{ background: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB" }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>
              {filtered.filter((p) => p.hasStock).length} farmacias con stock disponible
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: "#F9FAFB" }}>
            {filtered.map((pharmacy) => {
              const isSelected = selected === pharmacy.id;
              return (
                <button
                  key={pharmacy.id}
                  onClick={() => setSelected(pharmacy.id)}
                  className="w-full text-left p-4 rounded-xl transition-all relative overflow-hidden group"
                  style={{
                    background: "white",
                    border: isSelected ? "1px solid #00A69D" : "1px solid #E5E7EB",
                    boxShadow: isSelected ? "0 4px 12px rgba(0, 166, 157, 0.1)" : "0 2px 4px rgba(0,0,0,0.02)"
                  }}
                >
                  {/* Decorative left accent line */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 transition-all duration-300"
                    style={{ 
                      width: isSelected ? "4px" : "0px", 
                      background: "#00A69D" 
                    }}
                  />
                  
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className="text-sm leading-tight transition-colors"
                      style={{ color: isSelected ? "#00A69D" : "#203A70", fontWeight: 800 }}
                    >
                      {pharmacy.name}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: "#DCFCE7",
                        color: "#10B981",
                        fontWeight: 700,
                      }}
                    >
                      ✓ En stock
                    </span>
                  </div>
                  <p className="text-xs mb-3 leading-snug" style={{ color: "#6B7280" }}>
                    {pharmacy.address}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: isSelected ? "#00A69D" : "#9CA3AF" }}>
                      <Navigation size={12} />
                      {pharmacy.distance}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#9CA3AF" }}>
                      <Clock size={12} />
                      {pharmacy.hours}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div className="flex flex-col items-center py-10 gap-3" style={{ color: "#9CA3AF" }}>
                <Search size={32} />
                <p className="text-sm">
                  {search ? `Sin resultados para "${search}"` : "No se encontraron farmacias cercanas con stock"}
                </p>
              </div>
            )}
            {loading && (
              <div className="flex justify-center p-8 text-sm" style={{ color: "#9CA3AF" }}>
                Cargando farmacias...
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — MAP (70%) ── */}
        <div className="flex-1 relative overflow-hidden p-4 anim-slide-right anim-d-1">
          <div
            className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}
          >
            <APIProvider apiKey={(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ""}>
              {locationLoaded && (
                <Map
                  defaultZoom={14}
                  minZoom={14}
                  defaultCenter={{ lat: userLat, lng: userLon }}
                  disableDefaultUI={true}
                  styles={[
                    { featureType: "poi", stylers: [{ visibility: "off" }] },
                    { featureType: "transit", stylers: [{ visibility: "off" }] }
                  ]}
                >
                  {/* Marcador del Paciente */}
                  <Marker 
                    position={{ lat: userLat, lng: userLon }} 
                    zIndex={50}
                    icon={{
                      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#203A70" stroke="white" stroke-width="3" /><text x="20" y="26" font-size="18" text-anchor="middle" fill="white">👤</text></svg>')}`,
                      scaledSize: { width: 40, height: 40 } as any,
                      anchor: { x: 20, y: 20 } as any
                    }}
                    title="Tu ubicación"
                  />

                  {/* Marcadores de Farmacias */}
                  {pharmaciesList.map((p) => {
                    const isSelected = selected === p.id;
                    const size = isSelected ? 42 : 32;
                    const bg = isSelected ? "#00A69D" : "white";
                    const border = "#00A69D";
                    const inner = isSelected ? "white" : "#00A69D";
                    
                    const svgIcon = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="20" cy="20" r="18" fill="${bg}" stroke="${border}" stroke-width="3" />
                      <path d="M17 12 h6 v5 h5 v6 h-5 v5 h-6 v-5 h-5 v-6 h5 v-5 z" fill="${inner}" />
                    </svg>`;

                    return (
                      <Marker
                        key={p.id}
                        position={{ lat: p.lat, lng: p.lon }}
                        zIndex={isSelected ? 100 : 10}
                        onClick={() => setSelected(p.id)}
                        icon={{
                          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
                          scaledSize: { width: size, height: size } as any,
                          anchor: { x: size/2, y: size/2 } as any
                        }}
                      />
                    );
                  })}
                </Map>
              )}
            </APIProvider>
          </div>

          {/* Selected pharmacy detail card — floats over map top-left */}
          {selectedPharmacy && (
            <div
              className="absolute rounded-2xl p-0 anim-scale-in overflow-hidden flex flex-col"
              style={{
                left: "32px",
                top: "32px",
                bottom: "32px",
                background: "white",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                minWidth: "300px",
                maxWidth: "320px",
                zIndex: 40
              }}
            >
              {/* Street View Image or Fallback */}
              <div className="w-full flex-1 relative bg-gray-100 min-h-[150px]">
                {imgError ? (
                  <div className="absolute inset-0 bg-[#E5F6F5] flex flex-col items-center justify-center text-[#00A69D]">
                    <Building2 size={48} className="mb-2 opacity-50" />
                    <span className="text-sm font-bold opacity-70">Sin vista previa</span>
                  </div>
                ) : (
                  <img 
                    src={placePhotoUrl || `https://maps.googleapis.com/maps/api/streetview?size=400x600&location=${selectedPharmacy.lat},${selectedPharmacy.lon}&return_error_code=true&key=${(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ""}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    alt="Vista de la farmacia"
                  />
                )}
              </div>
              
              <div className="p-5 flex-shrink-0">
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
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: "#00A69D", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,166,157,0.3)" }}
                  >
                    <CheckCircle size={15} />
                    {assigning ? "Enviando..." : "Enviar receta a esta farmacia"}
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${selectedPharmacy.lat},${selectedPharmacy.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-all active:scale-95"
                    style={{ background: "#F3F4F6", color: "#203A70", fontWeight: 700 }}
                  >
                    <Navigation size={15} />
                    Cómo llegar (Ruta)
                  </a>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
