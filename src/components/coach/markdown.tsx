import { Fragment } from "react";

/** Minimal, safe markdown renderer for AI replies (no HTML injection): paragraphs, lists, headings, **bold**, *italic*, `code`. */
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((p, i) => {
    const k = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p) || /^_[^_]+_$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(p)) return <code key={k} className="rounded bg-elevated px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={`h${blocks.length}`} className="font-semibold text-foreground">
          {inline(heading[1]!, `h${blocks.length}`)}
        </p>,
      );
    } else if (bullet || ordered) {
      flushPara();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]!);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
