/** Feeds a controlled scenario through the recorder's state machine the way the screen does (a tick every second). */
import { addFix, finishTrack, pauseTrack, resumeTrack, startTrack, tick, type TrackState } from "@/lib/domain/gps-track";
import { T0, type Scenario } from "./gps-traces";

export function record(sc: Scenario): TrackState {
  let s = startTrack({ id: "sim", kind: sc.kind, unit: "km", now: T0 });
  let clock = T0;
  const pauses = [...sc.pauses];
  const advance = (to: number) => {
    while (clock + 1000 <= to) {
      clock += 1000;
      const p = pauses[0];
      if (p && clock >= p.at && s.status !== "paused") s = pauseTrack(s, p.at);
      if (p && clock >= p.resume && s.status === "paused") {
        s = resumeTrack(s, p.resume);
        pauses.shift();
      }
      s = tick(s, clock);
    }
  };
  for (const f of sc.fixes) {
    advance(f.t);
    s = addFix(s, f).state;
  }
  advance(sc.finishAt);
  return finishTrack(s, sc.finishAt);
}
