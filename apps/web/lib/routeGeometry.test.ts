import { describe, expect, it } from "vitest";
import { toLatLngs } from "./routeGeometry";

describe("toLatLngs", () => {
  it("swaps [longitude, latitude] into Leaflet's [latitude, longitude]", () => {
    expect(toLatLngs([[77.209, 28.6139], [77.2167, 28.6315]])).toEqual([[28.6139, 77.209], [28.6315, 77.2167]]);
  });

  it("drops points that are not finite or out of range, keeping a drawable route", () => {
    expect(toLatLngs([[77.209, 28.6139], [Number.NaN, 28.62], [77.2, 95], [77.2167, 28.6315]])).toEqual([[28.6139, 77.209], [28.6315, 77.2167]]);
  });

  it("refuses a route with fewer than two usable points", () => {
    expect(toLatLngs([])).toBeNull();
    expect(toLatLngs([[77.209, 28.6139]])).toBeNull();
    expect(toLatLngs([[77.209, 28.6139], [Number.NaN, Number.NaN]])).toBeNull();
  });

  it("refuses a route whose points are all the same place", () => {
    expect(toLatLngs([[77.209, 28.6139], [77.209, 28.6139], [77.209, 28.6139]])).toBeNull();
  });
});
