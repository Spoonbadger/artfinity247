import * as React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { SITE_URL } from "@/lib/urls";
import { EMAIL_COLORS, EMAIL_CONTACT, EMAIL_FONT, EMAIL_LOGO } from "@/lib/emailShell";

// The shared frame for Artfinity's emails: logo, a white card on the blush wall, and a quiet footer.
// Colors and logo come from lib/emailShell.ts, the string version of this frame, so both stay identical.
export const C = EMAIL_COLORS;
const font = EMAIL_FONT;
export const CONTACT = EMAIL_CONTACT;

export function EmailLayout({
  preview,
  children,
  footer,
}: {
  /** The grey line inbox lists show next to the subject. */
  preview: string;
  children: React.ReactNode;
  /** Why they got this email, e.g. "You're getting this because you have an Artfinity artist account." */
  footer?: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "32px 12px", backgroundColor: C.wall, fontFamily: font, color: C.ink }}>
        <Container style={{ maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ padding: "0 8px 20px" }}>
            <Link href={SITE_URL}>
              <Img src={EMAIL_LOGO} width="114" height="24" alt="Artfinity" style={{ display: "block", border: 0 }} />
            </Link>
          </Section>
          <Section style={{ backgroundColor: "#ffffff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "36px 36px 32px" }}>
            {children}
          </Section>
          <Section style={{ padding: "20px 8px 0" }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: C.ink2 }}>
              Questions? Reply to this email or write to{" "}
              <Link href={`mailto:${CONTACT}`} style={{ color: C.ink2, textDecoration: "underline" }}>{CONTACT}</Link>.
            </Text>
            {footer ? <Text style={{ margin: "8px 0 0", fontSize: 12, lineHeight: "18px", color: C.ink2 }}>{footer}</Text> : null}
            <Text style={{ margin: "8px 0 0", fontSize: 12, lineHeight: "18px", color: C.ink2 }}>
              Artfinity · <Link href={SITE_URL} style={{ color: C.ink2, textDecoration: "underline" }}>theartfinity.com</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Heading as="h1" style={{ margin: "0 0 16px", fontSize: 24, lineHeight: "30px", fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>{children}</Heading>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Heading as="h2" style={{ margin: "0 0 8px", fontSize: 16, lineHeight: "22px", fontWeight: 700, color: C.ink }}>{children}</Heading>;
}

export function P({ children, muted, small, style }: { children: React.ReactNode; muted?: boolean; small?: boolean; style?: React.CSSProperties }) {
  return (
    <Text style={{ margin: "0 0 16px", fontSize: small ? 13 : 15, lineHeight: small ? "20px" : "24px", color: muted ? C.ink2 : C.ink, ...style }}>
      {children}
    </Text>
  );
}

export function CTA({ href, children, secondary, last }: { href: string; children: React.ReactNode; secondary?: boolean; /** Last thing in the card: no space below. */ last?: boolean }) {
  return (
    <Section style={{ margin: last ? "8px 0 0" : "8px 0 24px" }}>
      <Button
        href={href}
        style={{
          display: "inline-block",
          padding: "12px 22px",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
          backgroundColor: secondary ? "#ffffff" : C.garnet,
          color: secondary ? C.garnet : "#ffffff",
          border: `1px solid ${C.garnet}`,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function Divider() {
  return <Hr style={{ margin: "8px 0 24px", border: "none", borderTop: `1px solid ${C.line}` }} />;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} style={{ color: C.garnet, textDecoration: "underline" }}>{children}</Link>;
}
