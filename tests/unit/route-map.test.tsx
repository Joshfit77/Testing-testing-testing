import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { distanceMarkers, RouteMap } from "@/components/run/route-map";
import { latToTileY, lngToTileX, tileConfigFromEnv, tilesForBounds, tileUrl, tileXToLng, tileYToLat, tileZoom } from "@/lib/domain/map-tiles";

// A straight line north: 0.01° of latitude ≈ 1,112 m.
const north = (fromM: number, toM: number): [number, number][] => [
  [-75, 40 + fromM / 111_195],
  [-75, 40 + toM / 111_195],
];

describe("route map", () => {
  it("places a marker at each whole kilometre or mile, skipping breaks", () => {
    const one = distanceMarkers([north(0, 2500)], "km");
    expect(one.map((m) => m.n)).toEqual([1, 2]);
    expect((one[0]!.at[1] - 40) * 111_195).toBeCloseTo(1000, -1);
    // A break between 1,200 m and 1,900 m is not bridged: the second kilometre comes 800 m into the second line.
    const broken = distanceMarkers([north(0, 1200), north(1900, 3000)], "km");
    expect(broken.map((m) => m.n)).toEqual([1, 2]);
    expect((broken[1]!.at[1] - 40) * 111_195).toBeCloseTo(2700, -1);
    expect(distanceMarkers([north(0, 3300)], "mi").map((m) => m.n)).toEqual([1, 2]);
  });

  it("draws start, finish, markers, dashed breaks and the live position", () => {
    const { getByTestId, getAllByTestId, queryByTestId, rerender } = render(<RouteMap coordinates={[north(0, 1200), north(1900, 3000)]} unit="km" />);
    expect(getAllByTestId("route-marker")).toHaveLength(2);
    expect(getAllByTestId("route-break")).toHaveLength(1);
    expect(queryByTestId("route-current")).toBeNull();
    expect(getByTestId("route-map").textContent).toContain("1 km");
    rerender(<RouteMap coordinates={[north(0, 1200)]} unit="mi" current={{ lat: 40 + 1250 / 111_195, lng: -75, accuracy: 6 }} />);
    expect(getByTestId("route-current").textContent).toContain("±6 m");
    expect(getByTestId("route-map").textContent).toMatch(/ft|mi/);
  });

  it("server-renders the same accessible title the browser renders (no hydration mismatch, React #418)", () => {
    // React renders a <title> from a single string only: with two text children the server sent an empty title while
    // the browser filled it in, so every run's detail page failed to hydrate.
    const html = renderToString(<RouteMap coordinates={[north(0, 3300)]} unit="mi" label="Route of this run" />);
    const title = html.match(/<title id="[^"]*-t">([^<]*)<\/title>/)?.[1];
    expect(title).toBe("Route of this run, 2 mi markers");
    const plain = renderToString(<RouteMap coordinates={[north(0, 400)]} unit="km" />);
    expect(plain.match(/<title id="[^"]*-t">([^<]*)<\/title>/)?.[1]).toBe("Route map with 1 recorded stretch");
    // Every title in the map is a single, non-empty string on the server.
    for (const t of html.matchAll(/<title[^>]*>([^<]*)<\/title>/g)) expect(t[1]!.trim()).not.toBe("");
  });

  it("has a background: a scale grid when no map provider is configured", () => {
    const { getByTestId, queryByTestId } = render(<RouteMap coordinates={[north(0, 3300)]} unit="mi" tiles={null} />);
    const grid = getByTestId("route-grid");
    expect(grid.querySelectorAll("line").length).toBeGreaterThan(4);
    expect(queryByTestId("route-tiles")).toBeNull();
    // Nothing is fetched from anywhere when tiles are off.
    expect(getByTestId("route-map").querySelectorAll("image")).toHaveLength(0);
  });

  it("draws configured map tiles under the route, aligned to it, with the provider's attribution", () => {
    const tiles = { url: "https://tiles.example.test/{z}/{x}/{y}.png", attribution: "© Example contributors", maxZoom: 19 };
    const { getByTestId, queryByTestId } = render(<RouteMap coordinates={[north(0, 3300)]} unit="mi" tiles={tiles} />);
    expect(queryByTestId("route-grid")).toBeNull();
    expect(getByTestId("route-attribution").textContent).toBe("© Example contributors");
    const images = [...getByTestId("route-tiles").querySelectorAll("image")];
    expect(images.length).toBeGreaterThan(0);
    expect(images.length).toBeLessThanOrEqual(24);
    // The start point [-75, 40] sits inside the tile the URL names for it, at the matching place on screen.
    const start = getByTestId("route-map").querySelector('circle[fill="#5fc49a"]')!;
    const sx = Number(start.getAttribute("cx"));
    const sy = Number(start.getAttribute("cy"));
    const z = Number(images[0]!.getAttribute("href")!.split("/")[3]);
    const want = `https://tiles.example.test/${z}/${Math.floor(lngToTileX(-75, z))}/${Math.floor(latToTileY(40, z))}.png`;
    const tile = images.find((i) => i.getAttribute("href") === want)!;
    expect(tile).toBeDefined();
    const x = Number(tile.getAttribute("x"));
    const y = Number(tile.getAttribute("y"));
    const w = Number(tile.getAttribute("width"));
    const h = Number(tile.getAttribute("height"));
    expect(sx).toBeGreaterThanOrEqual(x);
    expect(sx).toBeLessThanOrEqual(x + w);
    expect(sy).toBeGreaterThanOrEqual(y);
    expect(sy).toBeLessThanOrEqual(y + h);
    // …at the fraction of the tile that the Mercator maths puts it.
    expect((sx - x) / w).toBeCloseTo(lngToTileX(-75, z) % 1, 2);
    expect((sy - y) / h).toBeCloseTo(latToTileY(40, z) % 1, 1);
  });
});

describe("map tiles", () => {
  it("are off unless the owner configures an https template with an attribution", () => {
    expect(tileConfigFromEnv({})).toBeNull();
    expect(tileConfigFromEnv({ NEXT_PUBLIC_MAP_TILE_URL: "https://t.example/{z}/{x}/{y}.png" })).toBeNull();
    expect(tileConfigFromEnv({ NEXT_PUBLIC_MAP_TILE_URL: "http://t.example/{z}/{x}/{y}.png", NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© T" })).toBeNull();
    expect(tileConfigFromEnv({ NEXT_PUBLIC_MAP_TILE_URL: "https://t.example/tile.png", NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© T" })).toBeNull();
    expect(tileConfigFromEnv({ NEXT_PUBLIC_MAP_TILE_URL: "https://t.example/{z}/{x}/{y}.png", NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© T" })).toEqual({
      url: "https://t.example/{z}/{x}/{y}.png",
      attribution: "© T",
      maxZoom: 19,
    });
    // Off in this test environment and, by default, everywhere.
    expect(tileConfigFromEnv()).toBeNull();
  });

  it("convert between coordinates and tiles", () => {
    expect(lngToTileX(-180, 3)).toBe(0);
    expect(lngToTileX(0, 1)).toBe(1);
    expect(latToTileY(0, 1)).toBeCloseTo(1, 10);
    expect(tileXToLng(lngToTileX(-75.123, 15), 15)).toBeCloseTo(-75.123, 9);
    expect(tileYToLat(latToTileY(40.456, 15), 15)).toBeCloseTo(40.456, 9);
    expect(tileUrl("https://t/{z}/{x}/{y}.png", { z: 15, x: 9364, y: 12354 })).toBe("https://t/15/9364/12354.png");
  });

  it("pick a zoom that keeps tiles sharp without loading too many", () => {
    // About 0.08 drawing units per metre (a 5 km run on a 320-wide map) at 40° N.
    const z = tileZoom(0.08, 40);
    expect(z).toBeGreaterThanOrEqual(12);
    expect(z).toBeLessThanOrEqual(14);
    expect(tileZoom(1000, 40, 17)).toBe(17);
    const tiles = tilesForBounds([-75.05, 39.97, -74.95, 40.03], z);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(24);
    for (const t of tiles) expect(t.nw[1]).toBeGreaterThan(t.se[1]);
  });
});
