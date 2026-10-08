import type { RouteView } from "@taapsaathi/contracts";

export function selectShortestSuccessfulRoute(routes: RouteView[]): RouteView | undefined {
  return routes
    .filter((route) => route.provider === "AMAZON_LOCATION" && route.available && route.durationSeconds !== null)
    .sort((left, right) => (left.durationSeconds ?? Infinity) - (right.durationSeconds ?? Infinity))[0];
}
