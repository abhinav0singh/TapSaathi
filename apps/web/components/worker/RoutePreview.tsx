import type { RouteView } from "@taapsaathi/contracts";

function normalise(coordinates: RouteView["geometry"]["coordinates"]) {
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = maxLongitude - minLongitude || 1;
  const latitudeRange = maxLatitude - minLatitude || 1;

  return coordinates
    .map(([longitude, latitude]) => {
      const x = 16 + ((longitude - minLongitude) / longitudeRange) * 268;
      const y = 116 - ((latitude - minLatitude) / latitudeRange) * 92;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function RoutePreview({ route }: { route: RouteView }) {
  const points = normalise(route.geometry.coordinates);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-sky-50" aria-label={`Route preview to ${route.restPointName}`}>
      <svg viewBox="0 0 300 132" className="block h-32 w-full" role="img" aria-label={`Route to ${route.restPointName}`}>
        <defs>
          <pattern id="route-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#dbeafe" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="300" height="132" fill="url(#route-grid)" />
        <polyline points={points} fill="none" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points.split(" ")[0]?.split(",")[0]} cy={points.split(" ")[0]?.split(",")[1]} r="7" fill="#0f172a" />
        {(() => {
          const end = points.split(" ").at(-1)?.split(",") ?? ["0", "0"];
          return <circle cx={end[0]} cy={end[1]} r="9" fill="#16a34a" stroke="white" strokeWidth="4" />;
        })()}
      </svg>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Route preview · {route.provider === "AMAZON_LOCATION" ? "Amazon Location" : "Approximate route"}
      </p>
    </div>
  );
}
