// Code blocks for the developer pages: body font with tabular figures (no monospace on this site),
// an ink background and a few clear token colors. Pure and hook-free, so server and client pages can both use it.
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import CopyButton from "./CopyButton";

export type Lang = "html" | "json" | "shell" | "js";

const C = {
  tag: "text-[#ffd43b]",
  attr: "text-[#a9b0ff]",
  str: "text-[#9fe0bf]",
  key: "text-[#a9b0ff]",
  num: "text-[#ffb59e]",
  kw: "text-[#ff9b85]",
  dim: "text-white/45",
  cmd: "text-[#ffd43b] font-semibold",
};

const RULES: Record<Lang, [RegExp, string][]> = {
  html: [
    [/<!--[\s\S]*?-->/y, C.dim],
    [/<\/?[\w-]+/y, C.tag],
    [/\/?>/y, C.tag],
    [/[\w-]+(?==)/y, C.attr],
    [/"[^"]*"/y, C.str],
  ],
  json: [
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, C.key],
    [/"(?:[^"\\]|\\.)*"/y, C.str],
    [/-?\d+(?:\.\d+)?/y, C.num],
    [/\b(?:true|false|null)\b/y, C.kw],
    [/[{}[\],:]/y, C.dim],
  ],
  shell: [
    [/#.*$/my, C.dim],
    [/^\s*(?:curl|fetch)\b/my, C.cmd],
    [/\s-{1,2}[\w-]+/y, C.attr],
    [/"[^"]*"|'[^']*'/y, C.str],
  ],
  js: [
    [/\/\/.*$/my, C.dim],
    [/\b(?:const|let|await|async|return|function|new|for|of)\b/y, C.kw],
    [/"[^"]*"|'[^']*'|`[^`]*`/y, C.str],
    [/\b\d+\b/y, C.num],
    [/\b[A-Za-z_]\w*(?=\()/y, C.attr],
  ],
};

export function highlight(code: string, lang: Lang): ReactNode[] {
  const rules = RULES[lang];
  const out: ReactNode[] = [];
  let plain = "";
  let i = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  outer: while (i < code.length) {
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length) {
        flush();
        out.push(<span key={i} className={cls}>{m[0]}</span>);
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i++];
  }
  flush();
  return out;
}

export default function Code({
  code, lang = "html", title, copy = true, className, maxHeight,
}: { code: string; lang?: Lang; title?: ReactNode; copy?: boolean; className?: string; maxHeight?: number }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-[#17181f] text-white shadow-[0_2px_0_rgba(21,22,27,.15)]", className)}>
      {(title || copy) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
          <span className="truncate text-[12.5px] font-semibold text-white/60">{title}</span>
          {copy && <CopyButton text={code} />}
        </div>
      )}
      <pre
        className="num overflow-x-auto whitespace-pre px-4 py-3.5 font-body text-[13.5px] leading-[1.65] text-white/90"
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        tabIndex={0}
      >
        <code className="font-body">{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}
