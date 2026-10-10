"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardResponse, RiskState } from "@taapsaathi/contracts";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

type Worker = DashboardResponse["workers"][number];
type Intervention = DashboardResponse["activeInterventions"][number];

type OperationsMapProps = {
  hubName: string;
  workers: Worker[];
  activeInterventions: Intervention[];
  demoPending?: boolean;
  onStartDemo?: () => void;
};

const statusColors: Record<RiskState, string> = {
  SAFE: "#16a34a",
  CAUTION: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
  RESTING: "#2563eb",
  AWAITING_SUPERVISOR: "#7c3aed",
};

function centreOf(workers: Worker[]): [number, number] {
  if (workers.length === 0) return [28.6139, 77.209];
  const [longitude, latitude] = workers.reduce(
    ([longitudeSum, latitudeSum], worker) => [
      longitudeSum + worker.position[0],
      latitudeSum + worker.position[1],
    ],
    [0, 0]
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

export default function OperationsMap({
  hubName,
  workers,
  activeInterventions,
  demoPending = false,
  onStartDemo,
}: OperationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const dynamicLayersRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [tileUnavailable, setTileUnavailable] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(
    activeInterventions[0]?.workerId ?? workers[0]?.workerId ?? ""
  );
  const selectedWorker = workers.find((worker) => worker.workerId === selectedWorkerId) ?? workers[0];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function initialise() {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(containerRef.current, {
        attributionControl: true,
        zoomControl: true,
        minZoom: 10,
        maxZoom: 18,
      }).setView(centreOf(workers), 14);

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
      dynamicLayersRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet || !ready) return;

    dynamicLayersRef.current?.remove();
    const layers = leaflet.layerGroup().addTo(map);
    dynamicLayersRef.current = layers;
    const bounds = leaflet.latLngBounds([]);

    for (const worker of workers) {
      const position: [number, number] = [worker.position[1], worker.position[0]];
      const selected = worker.workerId === selectedWorker?.workerId;
      const marker = leaflet.circleMarker(position, {
        radius: selected ? 12 : 9,
        color: "#ffffff",
        weight: 4,
        fillColor: statusColors[worker.state],
        fillOpacity: 1,
      });
      marker.bindPopup(popupContent(worker), { offset: [0, -8] });
      marker.bindTooltip(worker.name, { direction: "top", offset: [0, -10] });
      marker.on("click", () => setSelectedWorkerId(worker.workerId));
      marker.addTo(layers);
      marker.getElement()?.setAttribute("aria-label", `${worker.name}: ${worker.state.replaceAll("_", " ")}`);
      bounds.extend(position);
    }

    for (const intervention of activeInterventions) {
      const route = intervention.route;
      if (!route || route.geometry.coordinates.length < 2) continue;

      const routePositions = route.geometry.coordinates.map(
        (coordinate) => [coordinate[1], coordinate[0]] as [number, number]
      );
      leaflet.polyline(routePositions, { color: "#ffffff", weight: 9, opacity: 0.9 }).addTo(layers);
      leaflet.polyline(routePositions, { color: "#ea580c", weight: 5, opacity: 0.95 }).addTo(layers);

      const destination = routePositions.at(-1);
      if (destination) {
        leaflet.circleMarker(destination, {
          radius: 11,
          color: "#ffffff",
          weight: 3,
          fillColor: "#0f766e",
          fillOpacity: 1,
        }).bindTooltip(`Rest point: ${route.restPointName}`, { permanent: true, direction: "top" })
          .addTo(layers);
      }
      routePositions.forEach((position) => bounds.extend(position));
    }

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
  }, [activeInterventions, ready, selectedWorker?.workerId, workers]);

  useEffect(() => {
    if (!selectedWorkerId && workers[0]) setSelectedWorkerId(workers[0].workerId);
  }, [selectedWorkerId, workers]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl shadow-slate-200/60">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative min-h-[320px] bg-slate-900 md:min-h-[390px]">
          <div ref={containerRef} className="absolute inset-0" aria-label={`Live rider map for ${hubName}`} />

          <div className="absolute left-4 top-4 z-[1000] max-w-[calc(100%-2rem)] rounded-2xl border border-white/20 bg-slate-950/90 px-4 py-3 text-white shadow-lg backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Live operations map</p>
            <p className="mt-1 text-sm font-semibold">{hubName}</p>
            <p className="mt-1 text-xs text-slate-300">
              {workers.length} riders · {activeInterventions.length} active intervention{activeInterventions.length === 1 ? "" : "s"}
            </p>
            {activeInterventions.length === 0 && onStartDemo && (
              <button
                type="button"
                disabled={demoPending}
                onClick={onStartDemo}
                className="mt-3 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-500 disabled:opacity-50"
              >
                {demoPending ? "Starting…" : "Start live demo"}
              </button>
            )}
          </div>

          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">Loading operational map…</div>
          )}

          {tileUnavailable && (
            <div
              className="absolute inset-0 z-[900] overflow-hidden bg-slate-900"
              style={{
                backgroundImage: "linear-gradient(rgba(148,163,184,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.09) 1px, transparent 1px), radial-gradient(circle at center, #1e293b 0, #0f172a 70%)",
                backgroundSize: "42px 42px, 42px 42px, auto",
              }}
            >
              {workers.map((worker) => (
                <button
                  key={worker.workerId}
                  type="button"
                  aria-label={`${worker.name}: ${worker.state.replaceAll("_", " ")}`}
                  title={`${worker.name} · ${worker.state.replaceAll("_", " ")}`}
                  onClick={() => setSelectedWorkerId(worker.workerId)}
                  className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white text-[10px] font-black text-white shadow-xl transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
                  style={{
                    ...fallbackPosition(workers, worker),
                    width: worker.workerId === selectedWorker?.workerId ? 36 : 30,
                    height: worker.workerId === selectedWorker?.workerId ? 36 : 30,
                    backgroundColor: statusColors[worker.state],
                  }}
                >
                  {worker.name.slice(0, 1)}
                </button>
              ))}
              <div role="status" className="absolute bottom-4 left-4 right-4 rounded-xl border border-amber-300/40 bg-slate-950/90 px-4 py-3 text-xs text-amber-100 shadow-lg md:right-auto md:max-w-sm">
                Street tiles are unavailable. Live relative positions and rider states remain active.
              </div>
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
