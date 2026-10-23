import { render } from "@testing-library/react";
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
});
