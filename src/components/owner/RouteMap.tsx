import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type Stop = { lat: number; lng: number; label: string; area: string };

export default function RouteMap({
  stops,
  route,
}: {
  stops: Stop[];
  route: { lat: number; lng: number }[];
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current).setView([27.322, 88.607], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      const colours: Record<string, string> = {
        Tadong: "#2563EB",
        "MG Marg": "#0D9488",
        Deorali: "#111827",
        "Development Area": "#D97706",
      };
      L.circleMarker([27.3314, 88.6138], { radius: 12, color: "#0D9488", fillOpacity: 1 })
        .addTo(map)
        .bindTooltip("Studio (start)", { permanent: false });
      stops.forEach((s, i) =>
        L.circleMarker([s.lat, s.lng], {
          radius: 9,
          color: colours[s.area] ?? "#0D9488",
          fillOpacity: 0.85,
        })
          .addTo(map!)
          .bindTooltip(`${i + 1}. ${s.label} · ${s.area}`),
      );
      if (route.length > 1)
        L.polyline(
          route.map((r) => [r.lat, r.lng] as [number, number]),
          { color: "#2563EB", weight: 4, dashArray: "6 6" },
        ).addTo(map);
      const pts = [
        [27.3314, 88.6138] as [number, number],
        ...stops.map((s) => [s.lat, s.lng] as [number, number]),
      ];
      if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30] });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [stops, route]);
  return (
    <div ref={el} className="z-0 h-80 w-full overflow-hidden rounded-2xl border border-border" />
  );
}
