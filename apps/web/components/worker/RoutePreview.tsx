import type { RouteView } from "@taapsaathi/contracts";

const WIDTH = 300;
const HEIGHT = 132;
const PAD_X = 16;
const PAD_Y = 24;

type Point = { x: number; y: number };

function toPoints(coordinates: RouteView["geometry"]["coordinates"]): Point[] | null {
  const valid = coordinates.filter(
    ([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude)
  );

  // A route needs a start and an end; anything less cannot be drawn.
  if (valid.length < 2) return null;

  const longitudes = valid.map(([longitude]) => longitude);
  const latitudes = valid.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const minLatitude = Math.min(...latitudes);

  // Scale longitude by cos(latitude) so short routes keep their true shape.
  const meanLatitude = latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length;
  const lonScale = Math.cos((meanLatitude * Math.PI) / 180) || 1;
  const spanX = (Math.max(...longitudes) - minLongitude) * lonScale;
  const spanY = Math.max(...latitudes) - minLatitude;

  // Every point identical: nothing meaningful to draw.
  if (spanX === 0 && spanY === 0) return null;

  const availableX = WIDTH - PAD_X * 2;
  const availableY = HEIGHT - PAD_Y * 2;
  const scale = Math.min(
    spanX > 0 ? availableX / spanX : Infinity,
    spanY > 0 ? availableY / spanY : Infinity
  );

  // Centre the route inside the frame.
  const offsetX = PAD_X + (availableX - spanX * scale) / 2;
  const offsetY = PAD_Y + (availableY - spanY * scale) / 2;

  return valid.map(([longitude, latitude]) => ({
    x: offsetX + (longitude - minLongitude) * lonScale * scale,
    y: HEIGHT - offsetY - (latitude - minLatitude) * scale,
  }));
}

export default function RoutePreview({ route }: { route: RouteView }) {
  const points = toPoints(route.geometry?.coordinates ?? []);
  const providerLabel = route.provider === "AMAZON_LOCATION" ? "Amazon Location" : "Approximate route";

  if (!points) {
    return (
      <div
        role="status"
        className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600"
      >
        Route preview is unavailable for this rest point. Use the distance and time shown above.
      </div>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-sky-50"
      aria-label={`Route preview to ${route.restPointName}`}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-32 w-full" role="img" aria-label={`Route to ${route.restPointName}`}>
        <defs>
          <pattern id="route-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#dbeafe" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#route-grid)" />
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#ea580c"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={start.x} cy={start.y} r="7" fill="#0f172a" />
        <circle cx={end.x} cy={end.y} r="9" fill="#16a34a" stroke="white" strokeWidth="4" />
      </svg>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Route preview · {providerLabel}
      </p>
    </div>
  );
}
