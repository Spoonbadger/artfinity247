// Text check for an artwork's title and description (auto-approval, lib/trust/artwork.ts). Pure and client-safe.
// It never rejects anything: a hit only means a person takes a look. Kept short on purpose, so art titles that use
// strong words now and then, or name animals and books, aren't held for nothing.

/**
 * Slurs, strong profanity and spam words, ROT13-encoded so the source stays readable. Matched as whole words, any
 * case. To read or add one, run it through any ROT13 tool (rot13 below does it both ways).
 */
const BLOCKED_ROT13 =
  "avttre,avttn,snttbg,snt,xvxr,fcvp,puvax,jrgonpx,genaal,ergneq,tbbx,enturnq,ornare,shpx,shpxvat,shpxre,zbgureshpxre,fuvg,phag,ovgpu,juber,fyhg,cbea,kkk,ivnten,pnfvab";

const rot13 = (s: string) => s.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + 97));
const BLOCKED = BLOCKED_ROT13.split(",").map(rot13);
const BLOCKED_RE = new RegExp(`(^|[^a-z])(${BLOCKED.join("|")})(s|es|ed|ing)?($|[^a-z])`, "i");

/** Links: a scheme, www., or a bare domain on a common TLD. "St. Louis" and "oil.canvas" don't count. */
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9-]{1,62}\.(com|net|org|io|co|shop|store|xyz|info|biz|me|ly|gg|app|site|online|link|click|top|ru|cn)\b(\/\S*)?/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Ten or more digits laid out like a phone number. Years ("2019-2023") and sizes ("24 x 36") don't match. */
const PHONE_RE = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const KEYBOARD_RE = /(asdf|qwer|zxcv|hjkl|sdfg|wxyz|jkl;)/i;

export type TextFlag = "text_profanity" | "text_link" | "text_email" | "text_phone" | "text_nonsense";

/** A title is nonsense when it has no letters, one letter over and over, keyboard mashing, or a long word with no vowels. */
export function looksLikeNonsense(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (!/\p{L}/u.test(t)) return true;
  if (/(.)\1{4,}/u.test(t.replace(/\s/g, ""))) return true;
  const letters = t.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length >= 6 && KEYBOARD_RE.test(letters) && letters.length <= 16) return true;
  // A long Latin word with no vowels (y counts). Non-Latin titles skip this.
  if (t.split(/\s+/).some((w) => /^[a-z]{8,}$/i.test(w) && !/[aeiouy]/i.test(w))) return true;
  return false;
}

/** What's wrong with a title and description, most serious first. Empty = fine. */
export function checkText(title: string, description: string): TextFlag[] {
  const both = `${title}\n${description}`;
  const out: TextFlag[] = [];
  if (BLOCKED_RE.test(both)) out.push("text_profanity");
  if (EMAIL_RE.test(both)) out.push("text_email");
  else if (URL_RE.test(both)) out.push("text_link");
  if (PHONE_RE.test(both)) out.push("text_phone");
  if (looksLikeNonsense(title)) out.push("text_nonsense");
  return out;
}
