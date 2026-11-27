import { ACTIVE_TRANSLATION } from "@/data/scripture";

/** Translation acknowledgement shown under the app's Scripture (Faith page, terms). */
export function ScriptureNotice({ className }: { className?: string }) {
  const t = ACTIVE_TRANSLATION;
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      {t.notice}
      {t.noticeUrl ? (
        <>
          {" "}
          <a href={t.noticeUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-highlight underline">
            {t.noticeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        </>
      ) : null}
    </p>
  );
}
