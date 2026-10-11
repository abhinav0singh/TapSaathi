import type { RouteView } from "@taapsaathi/contracts";
import { cn } from "@/lib/utils";

const WIDTH = 300;
const HEIGHT = 190;
const PAD_X = 36;
const PAD_Y = 40;

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

/** A calm, map-like sketch of the walk to shade. Blue dot is the rider, black pin is the shade. */
export default function RoutePreview({ route, className }: { route: RouteView; className?: string }) {
  const points = toPoints(route.geometry?.coordinates ?? []);
  const approximate = route.provider !== "AMAZON_LOCATION";

  if (!points) {
    return (
      <div role="status" className={cn("grid h-32 place-items-center bg-fill px-6 text-center text-[0.9375rem] text-label-2", className)}>
        Route sketch unavailable. Use the distance and time below.
      </div>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="block h-full min-h-44 w-full bg-fill-strong/60"
        role="img"
        aria-label={`${approximate ? "Approximate" : "Walking"} route to ${route.restPointName}`}
      >
        <defs>
          <pattern id="route-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#route-grid)" />
        <polyline points={path} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <polyline
          points={path}
          fill="none"
          stroke="#000000"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={approximate ? "1 9" : undefined}
        />
        <circle cx={start.x} cy={start.y} r="13" fill="#007aff" fillOpacity="0.18" />
        <circle cx={start.x} cy={start.y} r="7" fill="#007aff" stroke="#ffffff" strokeWidth="3" />
        <rect x={end.x - 8} y={end.y - 8} width="16" height="16" rx="3" fill="#000000" stroke="#ffffff" strokeWidth="3" />
      </svg>
    </div>
  );
}
