import { cn } from "@/lib/utils";

/**
 * Faith-led hero: the app's own vector sunrise-and-cross artwork behind content, with a dark gradient so white text
 * reads at any size. Decorative: the artwork is aria-hidden and the children carry the meaning.
 */
export function SceneHero({
  children,
  className,
  art = "/illustrations/sunrise-cross.svg",
  overlay = "to-bottom",
  minHeight = "min-h-[20rem]",
}: {
  children: React.ReactNode;
  className?: string;
  /** One of the original illustrations under /public/illustrations. */
  art?: string;
  /** "to-bottom": dark at the bottom (text below the sky); "to-left": dark at the left (text beside the cross). */
  overlay?: "to-bottom" | "to-left";
  minHeight?: string;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-[#140d05]", minHeight, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          overlay === "to-bottom" ? "bg-gradient-to-b from-black/35 via-black/10 to-[#070707]" : "bg-gradient-to-r from-black/75 via-black/30 to-transparent",
        )}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
