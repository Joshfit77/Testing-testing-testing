import { Fragment } from "react";
import { redLetterParts, type RedLetterSpan, type TextPart } from "@/lib/bible/red-letter";

/**
 * Bible text with the words of Jesus in red. Give it a verse's text and its spans, or ready-made parts for a passage.
 * No hooks, so server and client components can both use it. The text is rendered exactly as given.
 */
export function ScriptureText({ text = "", jesus, parts }: { text?: string; jesus?: readonly RedLetterSpan[] | null; parts?: readonly TextPart[] | null }) {
  const list = parts ?? redLetterParts(text, jesus);
  return (
    <>
      {list.map((p, i) =>
        p.jesus ? (
          <span key={i} className="text-red-letter" data-words-of-jesus="">
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
