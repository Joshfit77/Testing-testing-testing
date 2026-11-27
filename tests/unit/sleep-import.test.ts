import { samplesToSessions, summarizeVitals, type PlatformSleepSample } from "@/lib/domain/sleep-import";

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

describe("one writer per night and overnight measurements", () => {
  it("keeps the stages of the source with the most stage time and clips any same-source overlap", () => {
    const [s] = samplesToSessions([
      // The phone's bare "asleep" record and the watch's stages describe the same night; the watch wins.
      { startDate: "2026-10-22T22:30:00Z", endDate: "2026-10-23T06:30:00Z", sleepState: "asleep", platformId: "phone", sourceName: "iPhone" },
      { startDate: "2026-10-22T22:40:00Z", endDate: "2026-10-23T02:00:00Z", sleepState: "deep", platformId: "w1", sourceName: "Apple Watch" },
      // Overlaps the previous watch interval by ten minutes: clipped, not double-counted.
      { startDate: "2026-10-23T01:50:00Z", endDate: "2026-10-23T06:20:00Z", sleepState: "rem", platformId: "w2", sourceName: "Apple Watch" },
    ]);
    expect(s!.deviceName).toBe("Apple Watch");
    expect(s!.stages).toEqual([
      { stage: "deep", startedAt: "2026-10-22T22:40:00.000Z", endedAt: "2026-10-23T02:00:00.000Z" },
      { stage: "rem", startedAt: "2026-10-23T02:00:00.000Z", endedAt: "2026-10-23T06:20:00.000Z" },
    ]);
    const stageMinutes = s!.stages.reduce((acc, st) => acc + (Date.parse(st.endedAt) - Date.parse(st.startedAt)) / 60_000, 0);
    expect(stageMinutes).toBe(460);
    // The envelope still spans the phone's record.
    expect(s!.startedAt).toBe("2026-10-22T22:30:00.000Z");
    expect(s!.endedAt).toBe("2026-10-23T06:30:00.000Z");
  });

  it("summarises heart rate, HRV and respiratory rate inside the session, ignoring implausible values and samples outside it", () => {
    const hr = [
      { startDate: "2026-10-22T22:00:00Z", value: 70 }, // before bed
      { startDate: "2026-10-22T23:00:00Z", value: 58 },
      { startDate: "2026-10-23T02:00:00Z", value: 52 },
      { startDate: "2026-10-23T05:00:00Z", value: 61 },
      { startDate: "2026-10-23T03:00:00Z", value: 300 }, // glitch
    ];
    const hrv = [{ startDate: "2026-10-23T01:00:00Z", value: 42.26 }, { startDate: "2026-10-23T04:00:00Z", value: 38 }];
    const rr = [{ startDate: "2026-10-23T00:00:00Z", endDate: "2026-10-23T00:05:00Z", value: 14.2 }, { startDate: "2026-10-23T03:00:00Z", value: 15.1 }];
    const v = summarizeVitals("2026-10-22T22:30:00Z", "2026-10-23T06:30:00Z", { heartRate: hr, hrv, respiratoryRate: rr }, "sdnn");
    expect(v).toEqual({
      heartRate: { avg: 57, min: 52, max: 61, samples: 3 },
      hrv: { avgMs: 40.1, samples: 2, method: "sdnn" },
      respiratoryRate: { avg: 14.7, min: 14.2, max: 15.1, samples: 2 },
    });
    expect(summarizeVitals("2026-10-22T22:30:00Z", "2026-10-23T06:30:00Z", {}, "rmssd")).toBeNull();
    expect(summarizeVitals("2026-10-22T22:30:00Z", "2026-10-23T06:30:00Z", { heartRate: [{ startDate: "2026-10-23T08:00:00Z", value: 70 }] }, "rmssd")).toBeNull();
  });
});
