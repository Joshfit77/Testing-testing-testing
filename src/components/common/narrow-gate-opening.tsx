import { LogoMark } from "@/components/common/logo";
import { NarrowGateArt } from "@/components/common/narrow-gate-art";

/**
 * The opening sequence's content: the logo, the gate that opens onto soft white light, Matthew 7:13–14, Skip intro
 * and Enter Narrow Gate. Timing, the move into the light and the reduced-motion version are in globals.css (.ngo-*,
 * .ngs-*); the overlay around it is AppOpeningOverlay. The buttons carry data-intro-enter / data-intro-dismiss: the
 * inline head script (src/lib/opening.ts) handles them, even before hydration.
 */
export function NarrowGateOpening({ verse, translation }: { verse: string; translation: string }) {
  return (
    <>
      <NarrowGateArt />
      <div className="ngo-scrim" aria-hidden="true" />
      <div className="ngo-ui" data-testid="narrow-gate-opening">
        <button type="button" className="ngo-skip" data-intro-dismiss="">
          Skip intro
        </button>
        <div className="ngo-brand">
          <LogoMark />
          <h2 className="ngo-word">
            <b>Narrow Gate</b> <small>Fitness</small>
          </h2>
        </div>
        <div className="ngo-bottom">
          <figure className="ngo-verse">
            <blockquote id="ngo-verse">&ldquo;{verse}&rdquo;</blockquote>
            <figcaption>Matthew 7:13–14 ({translation})</figcaption>
          </figure>
          <button type="button" className="ngo-enter" data-intro-enter="">
            Enter Narrow Gate
          </button>
        </div>
      </div>
      {/* The light that fills the screen as the camera moves through the doorway. */}
      <div className="ngo-white" aria-hidden="true" />
    </>
  );
}
