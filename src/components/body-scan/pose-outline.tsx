import type { ScanPose } from "@/lib/domain/body-scan";
import { cn } from "@/lib/utils";

/** Dashed head-to-feet outline drawn over the camera so each scan is framed the same way. */
const FRONT =
  "M44,26 L56,26 L57,30 C65,31 71,34 72,41 L76,73 C77,77 73,78 72,74 L67,47 L66,81 L64,119 L62,151 L54,151 L51,97 L49,97 L46,151 L38,151 L36,119 L34,81 L33,47 L28,74 C27,78 23,77 24,73 L28,41 C29,34 35,31 43,30 Z";
const SIDE =
  "M46,26 L54,26 C59,31 61,37 61,47 L60,81 C60,93 59,111 57,151 L46,151 C45,121 43,101 43,83 L42,49 C42,37 43,31 46,26 Z M49,35 C47,51 47,65 50,79 C51,82 54,82 54,79 C53,65 53,51 53,35 Z";

export function PoseOutline({ pose, className }: { pose: ScanPose; className?: string }) {
  return (
    <svg viewBox="0 0 100 160" preserveAspectRatio="xMidYMid meet" className={cn("pointer-events-none", className)} aria-hidden>
      <circle cx="50" cy="16" r="9" fill="none" stroke="#f3dc8b" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <path d={pose === "side" ? SIDE : FRONT} fill="none" stroke="#f3dc8b" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {/* Head and feet lines: keep the whole body between them. */}
      <line x1="20" y1="5" x2="80" y2="5" stroke="#f3dc8b" strokeWidth="0.4" opacity="0.6" />
      <line x1="20" y1="154" x2="80" y2="154" stroke="#f3dc8b" strokeWidth="0.4" opacity="0.6" />
      <line x1="50" y1="5" x2="50" y2="154" stroke="#f3dc8b" strokeWidth="0.3" opacity="0.35" />
    </svg>
  );
}
