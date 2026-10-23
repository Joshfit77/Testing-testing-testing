import { samplesToSessions, type PlatformSleepSample } from "@/lib/domain/sleep-import";

describe("health-platform sleep samples to sessions", () => {
  it("merges HealthKit's in-bed envelope and segments into one night with onset, final wake and awake time", () => {
    const samples: PlatformSleepSample[] = [
      { startDate: "2026-10-22T22:00:00Z", endDate: "2026-10-23T06:00:00Z", sleepState: "inBed", platformId: "env" },
      { startDate: "2026-10-22T22:20:00Z", endDate: "2026-10-23T01:00:00Z", sleepState: "deep", platformId: "a" },
      { startDate: "2026-10-23T01:00:00Z", endDate: "2026-10-23T01:15:00Z", sleepState: "awake", platformId: "b" },
      { startDate: "2026-10-23T01:15:00Z", endDate: "2026-10-23T05:50:00Z", sleepState: "light", platformId: "c", sourceName: "Apple Watch" },
    ];
    const [s, ...rest] = samplesToSessions(samples);
    expect(rest).toEqual([]);
    expect(s).toMatchObject({
      sourceId: "p:a",
      startedAt: "2026-10-22T22:00:00.000Z",
      endedAt: "2026-10-23T06:00:00.000Z",
      onsetAt: "2026-10-22T22:20:00.000Z",
      finalWakeAt: "2026-10-23T05:50:00.000Z",
      awakeMinutes: 15,
      awakenings: 1,
      deviceName: "Apple Watch",
    });
    // The envelope isn't a stage; the three segments are, as given.
    expect(s!.stages.map((x) => x.stage)).toEqual(["deep", "awake", "light"]);
  });

  it("reads a Health Connect session with stage segments", () => {
    const [s] = samplesToSessions([
      {
        startDate: "2026-10-22T23:00:00Z",
        endDate: "2026-10-23T07:00:00Z",
        platformId: "hc-1",
        stages: [
          { startDate: "2026-10-22T23:00:00Z", endDate: "2026-10-23T00:30:00Z", stage: "light" },
          { startDate: "2026-10-23T00:30:00Z", endDate: "2026-10-23T02:00:00Z", stage: "deep" },
          { startDate: "2026-10-23T02:00:00Z", endDate: "2026-10-23T07:00:00Z", stage: "rem" },
        ],
      },
    ]);
    expect(s).toMatchObject({ sourceId: "p:hc-1", onsetAt: null, finalWakeAt: null, awakeMinutes: 0, awakenings: 0 });
    expect(s!.stages).toHaveLength(3);
  });

  it("keeps separate nights apart, drops noise, and fingerprints records without an id", () => {
    const out = samplesToSessions([
      { startDate: "2026-10-21T22:00:00Z", endDate: "2026-10-22T06:00:00Z", sleepState: "asleep" },
      { startDate: "2026-10-22T22:00:00Z", endDate: "2026-10-23T06:00:00Z", sleepState: "asleep" },
      { startDate: "2026-10-23T14:00:00Z", endDate: "2026-10-23T14:05:00Z", sleepState: "asleep" },
      { startDate: "bad", endDate: "2026-10-23T14:05:00Z", sleepState: "asleep" },
    ]);
    expect(out.map((s) => s.startedAt)).toEqual(["2026-10-21T22:00:00.000Z", "2026-10-22T22:00:00.000Z"]);
    expect(out[0]!.sourceId).toBe("t:2026-10-21T22:00:00.000Z:2026-10-22T06:00:00.000Z");
    expect(out[0]!.stages.map((s) => s.stage)).toEqual(["asleep"]);
  });

  it("leaves onset and wake-ups unknown when a record only says in bed", () => {
    const [s] = samplesToSessions([{ startDate: "2026-10-22T22:00:00Z", endDate: "2026-10-23T06:00:00Z", sleepState: "inBed", platformId: "x" }]);
    expect(s).toMatchObject({ onsetAt: null, finalWakeAt: null, awakeMinutes: null, awakenings: null, stages: [] });
  });
});
