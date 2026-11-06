// /admin/invite/<token>  Accept an admin invite. Rendered without the admin gate (see app/admin/layout.tsx).
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/af/Logo";
import { Problem } from "@/components/studio/Problem";
import { getUserFromCookie } from "@/lib/auth";
import { checkInvite } from "@/lib/adminTeam";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/adminCaps";
import { AcceptButton, LogoutButton, ResendConfirmButton } from "./InviteButtons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin invite", robots: { index: false } };

export default async function InvitePage({ params }: { params: { token: string } }) {
  const user = await getUserFromCookie();
  const c = await checkInvite(params.token, user?.id ?? null);
  const here = `/admin/invite/${params.token}`;
  const role = c.role;

  return (
    <main className="mx-auto grid min-h-[100svh] max-w-[520px] content-center gap-5 px-4 py-10">
      <Logo href="/" />
      <section className="af-card grid gap-4 p-5 sm:p-6">
        <div>
          <h1 className="display text-[36px] sm:text-[44px]">{c.ok || c.code === "unverified" || c.code === "wrong_account" ? "Join the Artfinity team" : "This invite can't be used"}</h1>
        </div>
        {role && (c.ok || c.code === "unverified" || c.code === "wrong_account") && (
          <p className="text-[15px] leading-relaxed">
            You&apos;re invited as <b>{ROLE_LABEL[role]}</b>: {ROLE_BLURB[role]} The invite is for <b>{c.email}</b>.
          </p>
        )}

        {c.ok && !user && (
          <>
            <p className="text-[14.5px] text-ink-2">Log in with {c.email}, or make an account with that address and confirm it. Then come back to this link.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-blue">Log in</Link>
              <Link href={`/register?next=${encodeURIComponent(here)}`} className="btn btn-ghost">Sign up</Link>
            </div>
          </>
        )}
        {c.ok && user && <AcceptButton token={params.token} />}
        {!c.ok && (
          <Problem tone="error" title={c.message} fix={["unverified", "wrong_account", "already_admin"].includes(c.code ?? "") ? undefined : { label: "Ask for a new invite", href: "/contact" }} />
        )}
        {!c.ok && c.code === "unverified" && <ResendConfirmButton />}
        {!c.ok && c.code === "wrong_account" && (
          <div className="flex flex-wrap items-center gap-2">
            <LogoutButton />
            <span className="text-[13px] text-ink-2">then log in as {c.email}.</span>
          </div>
        )}
        {!c.ok && c.code === "already_admin" && <Link href="/admin" className="btn btn-blue">Open the admin</Link>}
      </section>
    </main>
  );
}
