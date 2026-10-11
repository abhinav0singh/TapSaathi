import type { RouteView } from "@taapsaathi/contracts";

export type LatLng = [number, number];

/**
 * Backend coordinates are [longitude, latitude]; Leaflet wants [latitude, longitude].
 * Points that are not finite numbers (or outside the valid range) are dropped, and a route needs at
 * least a start and an end with some distance between them to be drawn.
 */
export function toLatLngs(coordinates: RouteView["geometry"]["coordinates"]): LatLng[] | null {
  const points: LatLng[] = [];
  for (const [longitude, latitude] of coordinates) {
    if (
      Number.isFinite(longitude) && Number.isFinite(latitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ) {
      points.push([latitude, longitude]);
    }
  }
  if (points.length < 2) return null;
  const first = points[0]!;
  const allSame = points.every(([latitude, longitude]) => latitude === first[0] && longitude === first[1]);
  return allSame ? null : points;
}
