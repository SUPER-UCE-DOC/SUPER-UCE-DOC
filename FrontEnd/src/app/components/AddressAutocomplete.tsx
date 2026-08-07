import React, { useEffect, useRef, useState } from "react";
import { useMapsLibrary, APIProvider } from "@vis.gl/react-google-maps";

interface AddressAutocompleteProps {
  apiKey: string;
  onAddressSelect: (address: string, lat: number, lon: number, placeId: string) => void;
  defaultValue?: string;
}

function AutocompleteInput({ onAddressSelect, defaultValue = "" }: Omit<AddressAutocompleteProps, 'apiKey'>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const options = {
      fields: ["geometry", "name", "formatted_address", "place_id"],
      componentRestrictions: { country: "do" }
    };
    const ac = new placesLib.Autocomplete(inputRef.current, options);
    setAutocomplete(ac);
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lon = place.geometry.location.lng();
        const address = place.formatted_address || place.name || "";
        const placeId = place.place_id || "";
        onAddressSelect(address, lat, lon, placeId);
        
        if (inputRef.current) {
          inputRef.current.value = address;
        }
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [autocomplete, onAddressSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder="Ej: Farmacia Carol, Av. Independencia"
      className="w-full px-4 py-2.5 rounded-lg border outline-none transition-all"
      style={{ borderColor: "#E5E7EB", fontSize: "16px" }}
      onFocus={(e) => (e.target.style.borderColor = "#00A69D")}
      onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
    />
  );
}

export function AddressAutocomplete(props: AddressAutocompleteProps) {
  return (
    <APIProvider apiKey={props.apiKey}>
      <AutocompleteInput onAddressSelect={props.onAddressSelect} defaultValue={props.defaultValue} />
    </APIProvider>
  );
}
