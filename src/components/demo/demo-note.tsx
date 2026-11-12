import { Notice } from "@/components/common/states";
import { isDemoMode } from "@/server/demo";

const NOTES = {
  gps: "Demo: the runs and walks in your history use sample routes, not real recordings. Live recording uses your phone's GPS and needs the iPhone or Android app outdoors; a computer's browser usually can't follow a route.",
  sleep: "Demo: sample nights. Apple Watch ones are pretend imports; real ones need the phone app.",
  bodyScan:
    "Demo: you can walk through the guided steps without uploading anything. Don't upload real body photos to a demo server; photos are only needed to save a scan.",
  mealPhoto:
    "Demo: no AI model is connected. Any photo returns the same fixed sample items, labelled as simulated, for you to review and edit. The photo isn't analysed or stored.",
  labelPhoto:
    "Demo: a label photo returns a fixed sample reading, labelled as simulated; it isn't read from your photo. Typed ingredients are checked for real by the app's own rules.",
  bibleAsk: "Demo: the Bible study helper needs a live AI model, so it is switched off in this demo. Questions get a short \"not available\" reply; nothing is sent anywhere.",
} as const;

/**
 * Demo deployments only: what on this screen is sample data, and what needs a real phone. `when` hides a note that
 * would be untrue (no sample nights to talk about).
 */
export function DemoNote({ topic, when = true }: { topic: keyof typeof NOTES; when?: boolean }) {
  if (!when || !isDemoMode()) return null;
  return (
    <Notice tone="info">
      <span data-testid={`demo-note-${topic}`}>{NOTES[topic]}</span>
    </Notice>
  );
}
