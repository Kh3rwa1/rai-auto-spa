import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export default function PinPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (p: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current).setView([27.3257, 88.6122], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      map.on("click", (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value) return;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      if (!markerRef.current) {
        markerRef.current = L.circleMarker([value.lat, value.lng], {
          radius: 10,
          color: "#0D9488",
          fillColor: "#0D9488",
          fillOpacity: 0.8,
        }).addTo(map);
      } else markerRef.current.setLatLng([value.lat, value.lng]);
    });
  }, [value]);

  return (
    <div ref={el} className="h-64 w-full overflow-hidden rounded-2xl border border-border z-0" />
  );
}
