"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardResponse } from "@taapsaathi/contracts";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { STATE_META, TONE_DOT, TONE_HEX } from "@/components/status/stateMeta";
import { cn } from "@/lib/utils";

type Worker = DashboardResponse["workers"][number];
type Intervention = DashboardResponse["activeInterventions"][number];

type Props = {
  hubName: string;
  workers: Worker[];
  activeInterventions: Intervention[];
  selectedId: string | null;
  onSelect: (workerId: string) => void;
  className?: string;
};

function centreOf(workers: Worker[]): [number, number] {
  if (workers.length === 0) return [28.6139, 77.209];
  const [longitude, latitude] = workers.reduce(
    ([longitudeSum, latitudeSum], worker) => [longitudeSum + worker.position[0], latitudeSum + worker.position[1]],
    [0, 0],
  );
  return [latitude / workers.length, longitude / workers.length];
}

function fallbackPosition(workers: Worker[], worker: Worker): { left: string; top: string } {
  const longitudes = workers.map((item) => item.position[0]);
  const latitudes = workers.map((item) => item.position[1]);
  const longitudeRange = Math.max(...longitudes) - Math.min(...longitudes) || 1;
  const latitudeRange = Math.max(...latitudes) - Math.min(...latitudes) || 1;
  const x = 18 + ((worker.position[0] - Math.min(...longitudes)) / longitudeRange) * 64;
  const y = 18 + (1 - (worker.position[1] - Math.min(...latitudes)) / latitudeRange) * 64;
  return { left: `${x}%`, top: `${y}%` };
}

function markerHtml(worker: Worker, selected: boolean): string {
  const color = TONE_HEX[STATE_META[worker.state].tone];
  const size = selected ? 40 : 34;
  const dark = STATE_META[worker.state].tone === "caution" ? "#000" : "#fff";
  const ring = selected ? "0 0 0 4px rgba(0,0,0,0.85)," : "";
  const initial = worker.name.slice(0, 1).toUpperCase();
  return `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:${dark};border:3px solid #fff;box-shadow:${ring}0 2px 8px rgba(0,0,0,.25);display:grid;place-items:center;font:600 14px Inter,system-ui,sans-serif">${initial}</div>`;
}

const LEGEND: Array<[string, keyof typeof TONE_DOT]> = [
  ["Safe", "safe"],
  ["Caution", "caution"],
  ["At risk", "high"],
  ["Resting", "rest"],
  ["Waiting", "wait"],
];

export default function OperationsMap({ hubName, workers, activeInterventions, selectedId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [tileUnavailable, setTileUnavailable] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function initialise() {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet
        .map(containerRef.current, { attributionControl: true, zoomControl: false, minZoom: 10, maxZoom: 18 })
        .setView(centreOf(workers), 14);
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);

      const tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      });
      tiles.on("tileerror", () => setTileUnavailable(true));
      tiles.on("load", () => setTileUnavailable(false));
      tiles.addTo(map);
      map.whenReady(() => setReady(true));

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
      resizeObserver.observe(containerRef.current);
    }

    void initialise().catch(() => {
      setTileUnavailable(true);
      setReady(true);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      leafletRef.current = null;
    };
    // The map is created once; markers and routes are redrawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet || !ready) return;

    layersRef.current?.remove();
    const layers = leaflet.layerGroup().addTo(map);
    layersRef.current = layers;
    const bounds = leaflet.latLngBounds([]);

    for (const intervention of activeInterventions) {
      const route = intervention.route;
      if (!route || route.geometry.coordinates.length < 2) continue;

      const points = route.geometry.coordinates.map((coordinate) => [coordinate[1], coordinate[0]] as [number, number]);
      leaflet.polyline(points, { color: "#ffffff", weight: 9, opacity: 1 }).addTo(layers);
      leaflet.polyline(points, { color: "#000000", weight: 4, opacity: 1 }).addTo(layers);

      const destination = points.at(-1);
      if (destination) {
        leaflet
          .marker(destination, {
            icon: leaflet.divIcon({
              className: "",
              iconSize: [18, 18],
              iconAnchor: [9, 9],
              html: '<div style="width:18px;height:18px;border-radius:5px;background:#000;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div>',
            }),
            interactive: false,
          })
          .bindTooltip(`Shade: ${route.restPointName}`, { permanent: true, direction: "right", offset: [12, 0] })
          .addTo(layers);
      }
      points.forEach((point) => bounds.extend(point));
    }

    for (const worker of workers) {
      const position: [number, number] = [worker.position[1], worker.position[0]];
      const selected = worker.workerId === selectedId;
      const size = selected ? 40 : 34;
      const marker = leaflet.marker(position, {
        icon: leaflet.divIcon({
          className: "",
          html: markerHtml(worker, selected),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: selected ? 1000 : 0,
        keyboard: true,
        title: `${worker.name}: ${STATE_META[worker.state].short.en}`,
      });
      marker.on("click", () => onSelect(worker.workerId));
      marker.addTo(layers);
      bounds.extend(position);
    }

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15, animate: false });
  }, [activeInterventions, onSelect, ready, selectedId, workers]);

  return (
    <section className={cn("relative overflow-hidden rounded-3xl bg-fill-strong", className)}>
      <div ref={containerRef} className="map-quiet absolute inset-0" aria-label={`Rider map for ${hubName}`} />

      {!ready && <div className="absolute inset-0 grid place-items-center text-[0.9375rem] text-label-2">Loading map…</div>}

      {tileUnavailable && (
        <div className="absolute inset-0 z-[900] overflow-hidden bg-fill-strong">
          {workers.map((worker) => (
            <button
              key={worker.workerId}
              type="button"
              aria-label={`${worker.name}: ${STATE_META[worker.state].short.en}`}
              onClick={() => onSelect(worker.workerId)}
              className={cn(
                "absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white text-sm font-semibold shadow-md",
                TONE_DOT[STATE_META[worker.state].tone],
                STATE_META[worker.state].tone === "caution" ? "text-black" : "text-white",
                worker.workerId === selectedId ? "size-10 ring-4 ring-black/85" : "size-[34px]",
              )}
              style={fallbackPosition(workers, worker)}
            >
              {worker.name.slice(0, 1).toUpperCase()}
            </button>
          ))}
          <p role="status" className="absolute inset-x-4 bottom-4 rounded-2xl bg-surface px-4 py-3 text-[0.875rem] text-label-2 shadow-sm sm:right-auto sm:max-w-sm">
            Street tiles are unavailable. Rider positions are relative and states are still live.
          </p>
        </div>
      )}

      <ul className="pointer-events-none absolute left-4 top-4 z-[1000] flex flex-wrap gap-x-3.5 gap-y-1 rounded-full bg-surface/95 px-3.5 py-2 text-[0.8125rem] text-label-2 shadow-sm backdrop-blur">
        {LEGEND.map(([label, tone]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", TONE_DOT[tone])} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
