import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { distanceMarkers, RouteMap } from "@/components/run/route-map";

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
});
