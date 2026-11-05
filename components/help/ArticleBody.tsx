// Renders the help center's markdown-lite bodies (format notes in content/help/types.ts). No dependencies, no HTML strings.
import type { ReactNode } from "react";
import Link from "next/link";

export type Heading = { id: string; text: string };

const slugId = (s: string) => s.toLowerCase().replace(/\*\*/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** **bold** and [text](href). Internal links use next/link; mailto and external use <a>. */
function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else {
      const href = m[3];
      const label = inline(m[2], k);
      out.push(href.startsWith("/") ? <Link key={k} href={href}>{label}</Link> : <a key={k} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>{label}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Kind = "h" | "ul" | "ol" | "quote" | "table" | "p";
const kindOf = (l: string): Kind =>
  /^#{2,3} /.test(l) ? "h" : /^\s*- /.test(l) ? "ul" : /^\s*\d+\. /.test(l) ? "ol" : l.startsWith(">") ? "quote" : l.startsWith("|") ? "table" : "p";

/** Split on blank lines, then into runs of one kind (a paragraph line followed by "- " lines becomes two blocks). */
function toBlocks(body: string): string[] {
  const out: string[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/)) {
    let run: string[] = [];
    let kind: Kind | null = null;
    for (const line of chunk.split("\n")) {
      const k = kindOf(line);
      if (run.length && (k !== kind || k === "h")) { out.push(run.join("\n")); run = []; }
      run.push(line);
      kind = k;
    }
    if (run.length) out.push(run.join("\n"));
  }
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseHeadings(body: string): Heading[] {
  return body.split("\n").filter((l) => l.startsWith("## ")).map((l) => {
    const text = l.slice(3).trim().replace(/\*\*/g, "");
    return { id: slugId(text), text };
  });
}

export default function ArticleBody({ body }: { body: string }) {
  const blocks = toBlocks(body);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trimEnd());
        const first = lines[0];
        const k = `b${i}`;
        if (first.startsWith("## ")) {
          const text = first.slice(3).trim();
          return <h2 key={k} id={slugId(text)} className="scroll-mt-24">{inline(text, k)}</h2>;
        }
        if (first.startsWith("### ")) return <h3 key={k}>{inline(first.slice(4).trim(), k)}</h3>;
        if (lines.every((l) => /^\s*- /.test(l))) return <ul key={k}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*- /, ""), `${k}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+\. /.test(l))) return <ol key={k}>{lines.map((l, j) => <li key={j} className="pl-1">{inline(l.replace(/^\s*\d+\. /, ""), `${k}-${j}`)}</li>)}</ol>;
        if (lines.every((l) => l.startsWith(">"))) {
          return (
            <aside key={k} className="relative my-6 rounded-2xl border-[1.5px] border-ink bg-[#fffbe8] px-5 py-4 pl-12 text-[16px] leading-relaxed">
              <i className="paint-dab absolute left-5 top-[22px]" style={{ ["--dab" as string]: "var(--af-sticker)" }} aria-hidden="true" />
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), k)}
            </aside>
          );
        }
        if (lines.every((l) => l.startsWith("|"))) {
          const rows = lines.filter((l) => !/^\|[\s:|-]+\|$/.test(l));
          const [head, ...rest] = rows;
          return (
            <div key={k} className="my-5 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full border-collapse text-left text-[15px]">
                <thead className="bg-wall">
                  <tr>{cells(head).map((c, j) => <th key={j} scope="col" className="px-3.5 py-2.5 font-semibold">{inline(c, `${k}h${j}`)}</th>)}</tr>
                </thead>
                <tbody className="num">
                  {rest.map((r, ri) => (
                    <tr key={ri} className="border-t border-line">
                      {cells(r).map((c, j) => <td key={j} className="px-3.5 py-2.5 align-top">{inline(c, `${k}r${ri}c${j}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={k}>{inline(lines.join(" "), k)}</p>;
      })}
    </>
  );
}
