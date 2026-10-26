import { Notice } from "@/components/common/states";
import { isDemoMode } from "@/server/demo";

const NOTES = {
  gps: "Demo: the runs and walks in your history use sample routes, not real recordings. Live recording uses your phone's GPS and needs the iPhone or Android app outdoors; a computer's browser usually can't follow a route.",
  sleep:
    "Demo: these nights are sample data. Nights labelled as from Apple Watch are pretend imports. Real Apple Health and Health Connect imports only work in the iPhone and Android apps on a phone.",
  bodyScan:
    "Demo: you can walk through the guided steps without uploading anything. Don't upload real body photos to a demo server; photos are only needed to save a scan.",
} as const;

/** Demo deployments only: what on this screen is sample data, and what needs a real phone. */
export function DemoNote({ topic }: { topic: keyof typeof NOTES }) {
  if (!isDemoMode()) return null;
  return (
    <Notice tone="info">
      <span data-testid={`demo-note-${topic}`}>{NOTES[topic]}</span>
    </Notice>
  );
}
