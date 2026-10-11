"use client";

import { useEffect, useRef, useState } from "react";
import type { RouteView } from "@taapsaathi/contracts";
import RoutePreview from "@/components/worker/RoutePreview";
import { toLatLngs } from "@/lib/routeGeometry";
import { cn } from "@/lib/utils";

type Props = {
  route: RouteView;
  className?: string;
  /** Words for the two markers, in the rider's language. */
  youLabel?: string;
  shadeLabel?: string;
};

const YOU_ICON =
  '<div style="position:relative;width:26px;height:26px"><div style="position:absolute;inset:0;border-radius:9999px;background:#007aff;opacity:.2"></div><div style="position:absolute;inset:6px;border-radius:9999px;background:#007aff;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div></div>';
const SHADE_ICON =
  '<div style="width:22px;height:22px;border-radius:6px;background:#000;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div>';

/**
 * The walk to shade, drawn on a real street map (the same Leaflet and OpenStreetMap setup as the
 * Operations map). It is a still picture: no dragging or zooming, so it never fights the page scroll
 * under a rider's thumb. If the map cannot start, the old route sketch is shown instead; if tiles are
 * slow or missing, the route line still draws on a plain background.
 */
export default function RouteMap({ route, className, youLabel = "You", shadeLabel = "Shade" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [tilesMissing, setTilesMissing] = useState(false);

  const points = toLatLngs(route.geometry?.coordinates ?? []);
  const approximate = route.provider !== "AMAZON_LOCATION";
  // Redraw only when the route itself changes, not on every poll that hands back an equal object.
  const routeKey = `${route.restPointId}:${route.generatedAt}:${points?.length ?? 0}`;

  useEffect(() => {
    if (!points || !containerRef.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const container = containerRef.current;

    async function draw() {
      const leaflet = await import("leaflet");
      if (cancelled || !points) return;

      map = leaflet.map(container, {
        // The sheet below slides up over the bottom of the map, so the credit sits at the top right.
        attributionControl: false,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        minZoom: 10,
        maxZoom: 18,
      });

      leaflet.control.attribution({ position: "topright", prefix: false }).addTo(map);
      const tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      });
      tiles.on("tileerror", () => setTilesMissing(true));
      tiles.on("load", () => setTilesMissing(false));
      tiles.addTo(map);

      leaflet.polyline(points, { color: "#ffffff", weight: 9, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);
      leaflet
        .polyline(points, {
          color: "#000000",
          weight: 4,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          // A dotted line says "approximate": the straight-line fallback is not a real walking route.
          ...(approximate ? { dashArray: "1 9" } : {}),
        })
        .addTo(map);

      const start = points[0]!;
      const end = points[points.length - 1]!;
      leaflet
        .marker(start, { icon: leaflet.divIcon({ className: "", html: YOU_ICON, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, keyboard: false })
        .addTo(map);
      leaflet
        .marker(end, { icon: leaflet.divIcon({ className: "", html: SHADE_ICON, iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false })
        .addTo(map);

      const fit = () => map?.fitBounds(leaflet.latLngBounds(points), { padding: [34, 34], maxZoom: 17, animate: false });
      fit();
      resizeObserver = new ResizeObserver(() => {
        map?.invalidateSize({ animate: false });
        fit();
      });
      resizeObserver.observe(container);
    }

    void draw().catch(() => setFailed(true));

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      map?.remove();
    };
    // `points` is derived from the route; routeKey is the stable signal that it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, approximate]);

  // No drawable route, or the map could not start: fall back to the sketch (which explains itself).
  if (!points || failed) return <RoutePreview route={route} className={className} />;

  return (
    <div className={cn("relative isolate overflow-hidden bg-fill-strong", className)}>
      <div
        ref={containerRef}
        className="map-quiet absolute inset-0"
        role="img"
        aria-label={`${approximate ? "Approximate" : "Walking"} route to ${route.restPointName}`}
      />
      <ul className="pointer-events-none absolute left-3 top-3 z-[500] flex gap-2 text-[0.8125rem] font-medium">
        <li className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-sm">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-rest" />
          {youLabel}
        </li>
        <li className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-sm">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-black" />
          {shadeLabel}
        </li>
      </ul>
      {tilesMissing && (
        <p role="status" className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-white/95 px-3 py-1.5 text-center text-[0.8125rem] text-label-2 shadow-sm">
          Map pictures are not loading. The route is still shown.
        </p>
      )}
    </div>
  );
}
