// /admin/social/setup: SOCIAL_SETUP.md, shown in the admin (it's where every "How to connect" link points), with a
// live checklist of which keys are set. Rendered by a tiny Markdown reader: headings, lists, tables, code, links.
import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { adminRoleOrRedirect } from "../../_components/gate";
import { igConfigured, igSetupState } from "@/lib/social/instagram";
import { cloudinaryOn } from "@/lib/social/storage";
import { cn } from "@/lib/utils";
import { PageHead, Pill } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Instagram setup" };

function readDoc() {
  try {
    return fs.readFileSync(path.join(process.cwd(), "SOCIAL_SETUP.md"), "utf8");
  } catch {
    return null;
  }
}

/** Inline: `code`, **bold**, [text](url) and bare example.com/path words. */
function inline(s: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`")) out.push(<code key={`${key}c${i++}`} className="rounded bg-wall px-1 py-0.5 text-[0.92em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("**")) out.push(<b key={`${key}b${i++}`}>{t.slice(2, -2)}</b>);
    else {
      const [, text, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      out.push(<a key={`${key}a${i++}`} href={href} className="font-semibold text-scan underline">{text}</a>);
    }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function render(md: string): ReactNode[] {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    const anchor = /^<a id="([\w-]+)"><\/a>$/.exec(l.trim());
    if (anchor) { out.push(<span key={k++} id={anchor[1]} className="block scroll-mt-24" />); i++; continue; }
    if (/^#{1,3} /.test(l)) {
      const level = l.match(/^#+/)![0].length;
      const text = l.replace(/^#+ /, "");
      out.push(level === 1 ? <h1 key={k++} className="display text-[40px] sm:text-[52px]">{text}</h1> : level === 2 ? <h2 key={k++} className="display mt-4 text-[28px]">{text}</h2> : <h3 key={k++} className="text-[17px] font-extrabold">{text}</h3>);
      i++; continue;
    }
    if (l.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++].trim());
      i++;
      out.push(<pre key={k++} tabIndex={0} className="overflow-x-auto rounded-xl bg-ink p-3 text-[12.5px] text-white"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim())); i++; }
      const [head, , ...body] = rows;
      out.push(
        <div key={k++} tabIndex={0} role="region" aria-label="Environment variables" className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13.5px]">
            <thead><tr>{head.map((h, j) => <th key={j} className="border-b border-line py-2 pr-3 font-bold">{inline(h)}</th>)}</tr></thead>
            <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, n) => <td key={n} className="border-b border-line py-2 pr-3 align-top">{inline(c, `${j}-${n}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*(\d+\.|-) /.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length && (/^\s*(\d+\.|-) /.test(lines[i]) || (/^\s{3,}\S/.test(lines[i]) && !lines[i].trim().startsWith("```")))) {
        const cur = lines[i];
        if (/^\s{2,}(\d+\.|-) /.test(cur) && items.length) items[items.length - 1].sub.push(cur.replace(/^\s*(\d+\.|-) /, ""));
        else if (/^\s*(\d+\.|-) /.test(cur)) items.push({ text: cur.replace(/^\s*(\d+\.|-) /, ""), sub: [] });
        else if (items.length) items[items.length - 1].text += " " + cur.trim();
        i++;
        // a fenced block inside a list item
        if (i < lines.length && lines[i].trim().startsWith("```") && items.length) {
          const code: string[] = [];
          i++;
          while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++].trim());
          i++;
          items[items.length - 1].sub.push(`\u0000${code.join("\n")}`);
        }
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={k++} className={cn("grid gap-1.5 pl-6 text-[14.5px]", ordered ? "list-decimal" : "list-disc")}>
          {items.map((it, j) => (
            <li key={j}>
              {inline(it.text, `li${j}`)}
              {it.sub.length > 0 && (
                <div className="mt-1 grid gap-1">
                  {it.sub.map((s, n) => s.startsWith("\u0000")
                    ? <pre key={n} tabIndex={0} className="overflow-x-auto rounded-xl bg-ink p-3 text-[12.5px] text-white"><code>{s.slice(1)}</code></pre>
                    : <Fragment key={n}><span className="block pl-3 text-ink-2">• {inline(s, `s${j}${n}`)}</span></Fragment>)}
                </div>
              )}
            </li>
          ))}
        </Tag>,
      );
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||```|\s*(\d+\.|-) |<a id)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(<p key={k++} className="max-w-[72ch] text-[14.5px]">{inline(para.join(" "), `p${k}`)}</p>);
  }
  return out;
}

export default async function SocialSetupPage() {
  await adminRoleOrRedirect("/admin/social/setup");
  const md = readDoc();
  const s = igSetupState();
  const checks = [
    { label: "INSTAGRAM_BUSINESS_ACCOUNT_ID", ok: s.accountId },
    { label: "INSTAGRAM_ACCESS_TOKEN", ok: s.token },
    { label: "App id and secret (token refresh)", ok: s.appCreds, optional: true },
    { label: "Cloudinary (public video URLs)", ok: cloudinaryOn() },
    { label: "CRON_SECRET (hourly job)", ok: !!process.env.CRON_SECRET?.trim() },
  ];
  return (
    <div className="grid gap-5">
      <PageHead back={{ href: "/admin/social", label: "Social" }} title="Instagram setup" sub={`${igConfigured() ? "Connected" : "Manual mode: not connected yet"} · Graph API ${s.version}`} />
      <section aria-label="What's set" className="grid gap-2 rounded-2xl border border-line bg-white p-4">
        <ul className="grid gap-1 text-[14px] sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <Pill tone={c.ok ? "green" : c.optional ? "grey" : "red"}>{c.ok ? "Set" : c.optional ? "Optional" : "Missing"}</Pill>
              {c.label}
            </li>
          ))}
        </ul>
      </section>
      <article className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:p-6">
        {md ? render(md) : <p className="text-[14.5px]">The guide is in the repository as SOCIAL_SETUP.md.</p>}
      </article>
    </div>
  );
}
