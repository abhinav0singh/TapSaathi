"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardResponse, RiskState } from "@taapsaathi/contracts";
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

type Worker = DashboardResponse["workers"][number];
type Intervention = DashboardResponse["activeInterventions"][number];

type OperationsMapProps = {
  hubName: string;
  workers: Worker[];
  activeInterventions: Intervention[];
};

const statusColors: Record<RiskState, string> = {
  SAFE: "#16a34a",
  CAUTION: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
  RESTING: "#2563eb",
  AWAITING_SUPERVISOR: "#7c3aed",
};

const emptyRoutes = { type: "FeatureCollection" as const, features: [] };

function routeFeatures(interventions: Intervention[]) {
  return {
    type: "FeatureCollection" as const,
    features: interventions.flatMap((intervention) => {
      const route = intervention.route;
      if (!route || route.geometry.coordinates.length < 2) return [];

      return [{
        type: "Feature" as const,
        properties: {
          interventionId: intervention.interventionId,
          restPointName: route.restPointName,
          provider: route.provider,
        },
        geometry: route.geometry,
      }];
    }),
  };
}

function centreOf(workers: Worker[]): [number, number] {
  if (workers.length === 0) return [77.209, 28.6139];

  const [longitude, latitude] = workers.reduce(
    ([longitudeSum, latitudeSum], worker) => [
      longitudeSum + worker.position[0],
      latitudeSum + worker.position[1],
    ],
    [0, 0]
  );

  return [longitude / workers.length, latitude / workers.length];
}

function popupContent(worker: Worker): HTMLElement {
  const content = document.createElement("div");
  content.className = "min-w-36 text-slate-900";

  const name = document.createElement("p");
  name.className = "font-bold";
  name.textContent = worker.name;

  const status = document.createElement("p");
  status.className = "mt-1 text-xs text-slate-600";
  status.textContent = worker.state.replaceAll("_", " ");

  const workload = document.createElement("p");
  workload.className = "mt-2 text-xs text-slate-500";
  workload.textContent = worker.activeTaskIds.length > 0
    ? `${worker.activeTaskIds.length} active delivery`
    : "No active delivery";

  content.append(name, status, workload);
  return content;
}

export default function OperationsMap({ hubName, workers, activeInterventions }: OperationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const mapLibraryRef = useRef<typeof import("maplibre-gl") | null>(null);
  const lastViewportRef = useRef("");
  const [ready, setReady] = useState(false);
  const [tileUnavailable, setTileUnavailable] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(
    activeInterventions[0]?.workerId ?? workers[0]?.workerId ?? ""
  );

  const selectedWorker = workers.find((worker) => worker.workerId === selectedWorkerId) ?? workers[0];
  const routes = useMemo(() => routeFeatures(activeInterventions), [activeInterventions]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function initialise() {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      mapLibraryRef.current = maplibre;
      maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
      const map = new maplibre.Map({
        container: containerRef.current,
        center: centreOf(workers),
        zoom: 14,
        minZoom: 10,
        maxZoom: 18,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            "open-street-map": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "open-street-map", type: "raster", source: "open-street-map" }],
        },
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
      map.on("error", (event) => {
        const message = event.error?.message ?? "";
        if (/tile|source|network|fetch/i.test(message)) setTileUnavailable(true);
      });
      map.on("load", () => {
        map.addSource("active-routes", { type: "geojson", data: emptyRoutes });
        map.addLayer({
          id: "active-route-shadow",
          type: "line",
          source: "active-routes",
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "active-route",
          type: "line",
          source: "active-routes",
          paint: { "line-color": "#ea580c", "line-width": 5, "line-opacity": 0.95 },
        });
        setReady(true);
      });

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    }

    void initialise().catch(() => {
      setTileUnavailable(true);
      setReady(true);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      mapLibraryRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = mapLibraryRef.current;
    if (!map || !maplibre || !ready) return;

    const source = map.getSource("active-routes") as GeoJSONSource | undefined;
    source?.setData(routes);

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const worker of workers) {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.setAttribute("aria-label", `${worker.name}: ${worker.state.replaceAll("_", " ")}`);
      markerButton.title = `${worker.name} · ${worker.state.replaceAll("_", " ")}`;
      markerButton.style.width = worker.workerId === selectedWorker?.workerId ? "30px" : "24px";
      markerButton.style.height = worker.workerId === selectedWorker?.workerId ? "30px" : "24px";
      markerButton.style.borderRadius = "9999px";
      markerButton.style.background = statusColors[worker.state];
      markerButton.style.border = "4px solid white";
      markerButton.style.boxShadow = "0 3px 12px rgba(15, 23, 42, 0.3)";
      markerButton.style.cursor = "pointer";
      markerButton.style.zIndex = "4";
      markerButton.addEventListener("click", () => setSelectedWorkerId(worker.workerId));

      const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 20 })
        .setDOMContent(popupContent(worker));
      const marker = new maplibre.Marker({ element: markerButton })
        .setLngLat(worker.position)
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }

    for (const intervention of activeInterventions) {
      const route = intervention.route;
      const destination = route?.geometry.coordinates.at(-1);
      if (!route || !destination) continue;

      const destinationMarker = document.createElement("div");
      destinationMarker.setAttribute("role", "img");
      destinationMarker.setAttribute("aria-label", `Rest point: ${route.restPointName}`);
      destinationMarker.title = route.restPointName;
      destinationMarker.style.display = "grid";
      destinationMarker.style.placeItems = "center";
      destinationMarker.style.width = "30px";
      destinationMarker.style.height = "30px";
      destinationMarker.style.borderRadius = "9px 9px 9px 2px";
      destinationMarker.style.transform = "rotate(-45deg)";
      destinationMarker.style.background = "#0f766e";
      destinationMarker.style.color = "white";
      destinationMarker.style.border = "3px solid white";
      destinationMarker.style.boxShadow = "0 3px 12px rgba(15, 23, 42, 0.25)";
      destinationMarker.style.zIndex = "3";

      const destinationLabel = document.createElement("span");
      destinationLabel.textContent = "R";
      destinationLabel.style.transform = "rotate(45deg)";
      destinationLabel.style.fontSize = "11px";
      destinationLabel.style.fontWeight = "800";
      destinationMarker.append(destinationLabel);

      const marker = new maplibre.Marker({ element: destinationMarker }).setLngLat(destination).addTo(map);
      markersRef.current.push(marker);
    }

    const coordinates = [
      ...workers.map((worker) => worker.position),
      ...activeInterventions.flatMap((intervention) => intervention.route?.geometry.coordinates ?? []),
    ];
    const viewportSignature = JSON.stringify(coordinates);

    if (coordinates.length > 0 && viewportSignature !== lastViewportRef.current) {
      const bounds = coordinates.reduce(
        (current, coordinate) => current.extend(coordinate),
        new maplibre.LngLatBounds(coordinates[0], coordinates[0])
      );
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 650 });
      lastViewportRef.current = viewportSignature;
    }
  }, [activeInterventions, ready, routes, selectedWorker?.workerId, workers]);

  useEffect(() => {
    if (!selectedWorkerId && workers[0]) setSelectedWorkerId(workers[0].workerId);
  }, [selectedWorkerId, workers]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl shadow-slate-200/60">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative min-h-[390px] bg-slate-900">
          <div ref={containerRef} className="absolute inset-0" aria-label={`Live rider map for ${hubName}`} />

          <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-2xl border border-white/20 bg-slate-950/85 px-4 py-3 text-white shadow-lg backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Live operations map</p>
            <p className="mt-1 text-sm font-semibold">{hubName}</p>
            <p className="mt-1 text-xs text-slate-300">
              {workers.length} riders · {activeInterventions.length} active intervention{activeInterventions.length === 1 ? "" : "s"}
            </p>
          </div>

          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">Loading operational map…</div>
          )}

          {tileUnavailable && (
            <div role="status" className="absolute bottom-8 left-4 z-10 max-w-sm rounded-xl border border-amber-300/40 bg-slate-950/90 px-4 py-3 text-xs text-amber-100 shadow-lg">
              Map tiles are unavailable. Live rider states, route details, and controls remain active.
            </div>
          )}
        </div>

        <aside className="border-t border-white/10 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Selected rider</p>
          {selectedWorker ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full ring-4 ring-white/10" style={{ backgroundColor: statusColors[selectedWorker.state] }} />
                <div>
                  <p className="text-xl font-bold">{selectedWorker.name}</p>
                  <p className="text-xs text-slate-400">{selectedWorker.workerId}</p>
                </div>
              </div>
              <p className="mt-5 text-sm font-semibold text-orange-300">{selectedWorker.state.replaceAll("_", " ")}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <dt className="text-xs text-slate-400">Active time</dt>
                  <dd className="mt-1 font-bold">{selectedWorker.activeMinutes} min</dd>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <dt className="text-xs text-slate-400">Deliveries</dt>
                  <dd className="mt-1 font-bold">{selectedWorker.activeTaskIds.length}</dd>
                </div>
              </dl>
              <a href={`/worker/${selectedWorker.workerId}`} className="mt-5 block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10">
                Open rider view
              </a>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No riders are available.</p>
          )}

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Legend</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-300">
              {([
                ["Safe", statusColors.SAFE],
                ["Caution", statusColors.CAUTION],
                ["Intervention", statusColors.HIGH],
                ["Follow-up", statusColors.AWAITING_SUPERVISOR],
              ] as const).map(([label, color]) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
