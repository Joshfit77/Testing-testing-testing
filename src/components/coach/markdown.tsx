import { Fragment, type ReactNode } from "react";

/**
 * Small, safe markdown renderer for AI replies. No HTML is ever injected: everything is rendered as
 * React text. Supports headings, paragraphs, bullet/numbered lists, blockquotes, fenced code, tables,
 * horizontal rules, **bold**, *italic*, `code` and [links](https://…) (https only, opened safely).
 */
export function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g);
  return parts.map((p, i) => {
    const k = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{inline(p.slice(2, -2), k)}</strong>;
    if (/^\*[^*]+\*$/.test(p) || /^_[^_]+_$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(p)) return <code key={k} className="rounded bg-elevated px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    const link = p.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (link)
      return (
        <a key={k} href={link[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-gold-highlight underline">
          {link[1]}
        </a>
      );
    return <Fragment key={k}>{p}</Fragment>;
  });
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableDivider = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let quote: string[] = [];
  const key = () => `b${blocks.length}`;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={key()}>{inline(para.join(" "), key())}</p>);
    para = [];
  };
  const flushQuote = () => {
    if (quote.length)
      blocks.push(
        <blockquote key={key()} className="border-l-2 border-gold-muted pl-3 italic text-muted-foreground">
          {inline(quote.join(" "), key())}
        </blockquote>,
      );
    quote = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    const k = key();
    blocks.push(
      <Tag key={k} className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `${k}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
    if (/^\s*```/.test(line)) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      blocks.push(
        <pre key={key()} className="overflow-x-auto rounded-xl bg-elevated p-3 text-xs">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1]!)) {
      flushAll();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]!)) rows.push(cells(lines[i++]!));
      i--;
      const k = key();
      blocks.push(
        <div key={k} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th key={j} className="border-b border-border px-2 py-1 font-semibold text-foreground">
                    {inline(h, `${k}-h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border-b border-border/50 px-2 py-1">
                      {inline(c, `${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (!line.trim()) {
      flushAll();
    } else if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      flushAll();
      blocks.push(<hr key={key()} className="border-border" />);
    } else if (heading) {
      flushAll();
      blocks.push(
        <p key={key()} className="font-semibold text-foreground">
          {inline(heading[1]!, key())}
        </p>,
      );
    } else if (bq) {
      flushPara();
      flushList();
      quote.push(bq[1]!);
    } else if (bullet || ordered) {
      flushPara();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]!);
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
