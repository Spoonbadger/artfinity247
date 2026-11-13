// Blocks slurs and strong profanity in an artist's @handle and display name (sign-up, social sign-up, Studio name
// changes, the live "is this link free?" check). Pure and client-safe, so the sign-up form can warn before submitting.
//
// Two tiers, so ordinary names and words aren't caught by mistake:
//   SEVERE: slurs and the strongest profanity. Blocked anywhere in a handle ("xfuckx", "shit_art") and anywhere
//           inside a word of a name. A short allow list keeps real places and words that contain them
//           ("Scunthorpe", "therapist", "Shital").
//   MILD:   words that are only a problem on their own ("ass", "dick", "cock"). Blocked only as a whole word, so
//           "classic", "dickens", "peacock" and "bass.player" are fine. A few are real first names or surnames
//           ("Dick", "Dyke", "Cox", "Fanny", "Kike") and are allowed in display names, not in handles.
//
// Matching ignores case and accents, reads common look-alike characters (f4gg0t, sh1t, $lut) and stretched letters
// (fuuuck). It never changes what the person typed; it only says yes or no.
//
// The words are ROT13-encoded so the source stays readable (same as lib/trust/text.ts). To read or add one, run it
// through any ROT13 tool; `rot13` below works both ways.

const SEVERE_ROT13 =
  "avttre,avttn,avttnu,snttbg,shpx,phag,fuvg,ovgpu,juber,fyhg,ergneq,jrgonpx,enturnq,gbjryurnq,genaal,cbeauho,cbeafgne,wvmm,nffubyr,encvfg,zbyrfgre,crqbcuvyr,cnrqbcuvyr,uvgyre,xxx,gvggvrf,qvpxurnq,pbpxfhpxre,onfgneq,gjng,jnaxre";
const MILD_ROT13 =
  "nff,nefr,qvpx,pbpx,gvgf,gvg,obbo,obbof,phz,encr,anmv,ubzb,snt,sntf,fcvp,puvax,pbba,tbbx,qlxr,ubr,chffl,cravf,nany,frk,frkl,kkk,urvy,crqb,zvys,arteb,wnc,cnxv,tlc,fxnax,cevpx,fynt,snaal,cbea,cbeab,ahqr,ahqrf,ubeal,baylsnaf,xvxr";
/** Mild words that are also real names or nicknames, allowed in a display name ("Dick Van Dyke", "Courteney Cox", "Kike" for Enrique). */
const NAME_OK_ROT13 = "qvpx,qlxr,ubr,pbba,pbk,snaal,frk,xvxr,arteb";
/** Real words and places that contain a severe word. Removed before the severe check. */
const ALLOW_ROT13 = "fphagubecr,cravfgbar,pbpxohea,fuvgnxr,fuvvgnxr,fuvgmh,fuvgny,fuvgnafuh,fuvgnen,fyhgfx,gurencvfg,fhffrk,rffrk,zvqqyrfrk,jrffrk,nffnffva,onffrgg,pnffrggr";

export const rot13 = (s: string) => s.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + 97));
const decode = (list: string) => list.split(",").map(rot13);

const SEVERE = decode(SEVERE_ROT13);
const MILD = decode(MILD_ROT13);
const NAME_OK = new Set(decode(NAME_OK_ROT13));
const ALLOW = decode(ALLOW_ROT13);

/** "fuck" -> "f{1,}u{1,}c{1,}k{1,}", so stretched letters still match but "niger" doesn't match a word with "gg". */
const stretchy = (w: string) => w.replace(/(.)\1*/g, (run, c: string) => `${c}{${run.length},}`);

const SEVERE_RE = new RegExp(`(${SEVERE.map(stretchy).join("|")})`);
const mildRe = (words: string[]) => new RegExp(`^(${words.map(stretchy).join("|")})$`);
const MILD_RE = mildRe(MILD);
const MILD_NAME_RE = mildRe(MILD.filter((w) => !NAME_OK.has(w)));

/** Lower case, accents removed. */
const plain = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const LEET: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i", "|": "l", "+": "t" };
/** Look-alike characters read as letters. "1" can stand for i or l, so both readings come back. */
function readings(s: string): string[] {
  const base = s.replace(/[0-9@$!|+]/g, (c) => LEET[c] ?? c);
  return base.includes("1") ? [base.replace(/1/g, "i"), base.replace(/1/g, "l")] : [base];
}

const lettersOnly = (s: string) => s.replace(/[^a-z]/g, "");
const withoutAllowed = (s: string) => ALLOW.reduce((acc, w) => acc.split(w).join(""), s);

function severeIn(s: string): boolean {
  return readings(s).some((r) => SEVERE_RE.test(withoutAllowed(lettersOnly(r))));
}

function mildWord(word: string, re: RegExp): boolean {
  if (!word) return false;
  // "ass99" and "99ass" count as "ass"; digits inside a word are read as letters ("a55").
  const trimmed = word.replace(/^\d+|\d+$/g, "");
  return [word, trimmed].some((w) => w && readings(w).some((r) => re.test(lettersOnly(r))));
}

/** True when a handle (with or without the @) has a slur or strong profanity in it. */
export function isOffensiveHandle(raw: string): boolean {
  const h = plain(String(raw || "").trim().replace(/^@/, ""));
  if (!h) return false;
  if (severeIn(h)) return true;
  return h.split(/[^a-z0-9@$!|+]+/).some((part) => mildWord(part, MILD_RE));
}

/** True when a display name has a slur or strong profanity in it. Real names that look like mild words pass. */
export function isOffensiveName(raw: string): boolean {
  const n = plain(String(raw || "").trim());
  if (!n) return false;
  const words = n.split(/[^a-z0-9@$!|+]+/).filter(Boolean);
  return words.some((w) => severeIn(w) || mildWord(w, MILD_NAME_RE));
}

/** Shown when a handle or name is refused. Plain, not preachy. */
export const OFFENSIVE_HANDLE_MESSAGE = "That link isn't allowed on Artfinity. Try another.";
export const OFFENSIVE_NAME_MESSAGE = "That name isn't allowed on Artfinity. Try another.";
