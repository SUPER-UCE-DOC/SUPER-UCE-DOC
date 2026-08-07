import React, { useState, useEffect, useRef, useCallback } from "react";
import { Map, Marker, useMap, useMapsLibrary, APIProvider } from "@vis.gl/react-google-maps";
import { Search, MapPin, CheckCircle, Navigation } from "lucide-react";

interface PharmacyMapPickerProps {
  onConfirm: (placeId: string, address: string, lat: number, lon: number, name: string) => void;
  selectedPlaceId?: string;
}

function PharmacyMapPickerContent({ onConfirm, selectedPlaceId }: PharmacyMapPickerProps) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  
  const [center, setCenter] = useState({ lat: 18.463, lng: -69.304 });
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [pharmacies, setPharmacies] = useState<google.maps.places.PlaceResult[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<google.maps.places.PlaceResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  // Initialize PlacesService
  useEffect(() => {
    if (!placesLib || !map) return;
    setPlacesService(new placesLib.PlacesService(map));
  }, [placesLib, map]);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          setUserLocation(loc);
          if (map) map.setCenter(loc);
        },
        (err) => console.warn("Geolocation failed", err)
      );
    }
  }, [map]);

  // Search Nearby Pharmacies when center changes significantly or manually triggered
  const searchPharmacies = useCallback((location: {lat: number, lng: number}) => {
    if (!placesService) return;
    placesService.nearbySearch(
      {
        location,
        radius: 5000,
        type: "pharmacy",
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPharmacies(results);
          // If we had a selected place, make sure it's in the list or we keep it selected
        }
      }
    );
  }, [placesService]);

  // Trigger search on mount and when map is initialized
  useEffect(() => {
    if (placesService && center) {
      searchPharmacies(center);
    }
  }, [placesService, center, searchPharmacies]); // We only want this once or when center changes manually

  // Handle map idle to fetch new pharmacies if moved
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const newCenter = map.getCenter();
      if (newCenter) {
        searchPharmacies({ lat: newCenter.lat(), lng: newCenter.lng() });
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, searchPharmacies]);

  // Setup SearchBox for finding a city/place
  useEffect(() => {
    if (!placesLib || !searchBoxRef.current) return;
    const sb = new placesLib.SearchBox(searchBoxRef.current);
    setSearchBox(sb);
  }, [placesLib]);

  useEffect(() => {
    if (!searchBox || !map) return;
    const listener = searchBox.addListener("places_changed", () => {
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const p = places[0];
        if (p.geometry && p.geometry.location) {
          const newLoc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() };
          map.setCenter(newLoc);
          map.setZoom(15);
          searchPharmacies(newLoc);
        }
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [searchBox, map, searchPharmacies]);

  const handleSelect = (p: google.maps.places.PlaceResult) => {
    setSelectedPharmacy(p);
  };

  const handleConfirm = () => {
    if (selectedPharmacy && selectedPharmacy.place_id && selectedPharmacy.geometry?.location) {
      onConfirm(
        selectedPharmacy.place_id,
        selectedPharmacy.vicinity || selectedPharmacy.formatted_address || "Sin dirección",
        selectedPharmacy.geometry.location.lat(),
        selectedPharmacy.geometry.location.lng(),
        selectedPharmacy.name || "Farmacia"
      );
      setSelectedPharmacy(null);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col rounded-xl overflow-hidden shadow-inner border border-gray-200 bg-gray-50 min-h-[300px]">
      {/* Search Bar overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-md flex items-center px-4 py-3 border border-gray-100">
          <Search size={18} className="text-gray-400 mr-3" />
          <input
            ref={searchBoxRef}
            type="text"
            placeholder="Buscar ciudad o sector (Ej: Santo Domingo)"
            className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <Map
          defaultZoom={15}
          defaultCenter={center}
          disableDefaultUI={false}
          styles={[
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ]}
        >
          {pharmacies.map((p) => {
            const isSelected = selectedPharmacy?.place_id === p.place_id;
            const isConfirmed = selectedPlaceId === p.place_id;
            
            const size = isSelected || isConfirmed ? 38 : 30;
            const bg = isConfirmed ? "#00A69D" : (isSelected ? "#203A70" : "white");
            const border = isConfirmed ? "#00A69D" : (isSelected ? "#203A70" : "#9CA3AF");
            const inner = isConfirmed || isSelected ? "white" : "#9CA3AF";
            
            const svgIcon = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="${bg}" stroke="${border}" stroke-width="3" />
              <circle cx="20" cy="20" r="8" fill="${inner}" />
            </svg>`;

            return (
              <Marker
                key={p.place_id}
                position={{ lat: p.geometry?.location?.lat() || 0, lng: p.geometry?.location?.lng() || 0 }}
                zIndex={isSelected || isConfirmed ? 100 : 10}
                onClick={() => handleSelect(p)}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
                  scaledSize: { width: size, height: size } as any,
                  anchor: { x: size/2, y: size/2 } as any
                }}
                label={isSelected || isConfirmed ? {
                  text: p.name || "",
                  className: "font-bold mt-8 whitespace-nowrap px-2 py-1 bg-white rounded shadow-sm border",
                  color: isConfirmed ? "#00A69D" : "#203A70"
                } : undefined}
              />
            );
          })}
        </Map>
      </div>

      {/* Info Panel when a pharmacy is selected */}
      {selectedPharmacy && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm bg-white rounded-xl shadow-2xl p-4 border-2 border-teal-500 anim-fade-in-up z-20">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">{selectedPharmacy.name}</h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <MapPin size={12} /> {selectedPharmacy.vicinity || selectedPharmacy.formatted_address}
              </p>
            </div>
            <button onClick={() => setSelectedPharmacy(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <button 
            type="button"
            onClick={handleConfirm}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <CheckCircle size={16} /> Confirmar esta ubicación
          </button>
        </div>
      )}
      
      {/* Confirmed overlay */}
      {!selectedPharmacy && selectedPlaceId && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-sm bg-white rounded-xl shadow-lg p-3 border-2 border-teal-500 flex items-center justify-between z-20 anim-fade-in-up">
           <div className="flex items-center gap-2 text-teal-700">
             <CheckCircle size={18} />
             <span className="text-sm font-bold">Ubicación confirmada</span>
           </div>
           <button type="button" onClick={() => onConfirm("", "", 0, 0, "")} className="text-xs font-semibold text-gray-500 hover:text-teal-600 underline">
             Cambiar
           </button>
        </div>
      )}
    </div>
  );
}

export function PharmacyMapPicker(props: PharmacyMapPickerProps) {
  return (
    <APIProvider apiKey={(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ""}>
      <PharmacyMapPickerContent {...props} />
    </APIProvider>
  );
}
