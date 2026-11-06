"use client";

import Link from "next/link";
import { ReactNode, useId } from "react";
import { Check } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { FONT_PAIRS } from "./fonts";
import { BACKGROUNDS, BUTTON_STYLES, FONTS, PAINTS, contrast, type LinksArt, type LinksTheme } from "./model";

type Set = <K extends keyof LinksTheme>(key: K, value: LinksTheme[K]) => void;

function Group({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2.5 text-[14px] font-bold text-ink">{label}</legend>
      {children}
      {hint}
    </fieldset>
  );
}

/** Radio pills that look like a segmented control. */
function Segmented<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o.id} className="relative cursor-pointer">
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
          <span className="inline-flex min-h-[40px] items-center rounded-full border-[1.5px] border-line bg-white px-4 text-[14px] font-semibold text-ink transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Paint palette + custom color. */
export function PaintPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const name = useId();
  const custom = !PAINTS.some((p) => p.hex === value);
  return (
    <Group label={label}>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
        {PAINTS.map((p) => (
          <label key={p.hex} className="relative cursor-pointer" title={p.name}>
            <input type="radio" name={name} checked={value === p.hex} onChange={() => onChange(p.hex)} className="peer sr-only" aria-label={p.name} />
            <span
              className="grid h-9 w-9 place-items-center border-[1.5px] border-[rgba(21,22,27,.15)] transition peer-checked:scale-110 peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan"
              style={{ background: p.hex, borderRadius: "52% 44% 58% 40%" }}
            >
              {value === p.hex && <Check className="h-4 w-4" style={{ color: contrast(p.hex, "#ffffff") > 2.2 ? "#fff" : "#15161b" }} aria-hidden="true" />}
            </span>
          </label>
        ))}
        <label className={cn("ml-1 inline-flex h-9 items-center gap-2 rounded-full border-[1.5px] pl-1 pr-3 text-[13px] font-semibold", custom ? "border-ink" : "border-line")}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label={`${label}: custom color`} />
          {custom ? value : "Custom"}
        </label>
      </div>
    </Group>
  );
}

function ButtonSample({ style, theme }: { style: LinksTheme["button"]; theme: LinksTheme }) {
  const solid = { background: theme.buttonColor, color: theme.textColor };
  const base = "relative z-0 flex h-9 w-full items-center justify-center text-[13px] font-bold";
  if (style === "brush")
    return (
      <span className={base} style={{ color: theme.textColor }}>
        <BrushStroke className="absolute inset-0 -z-10 h-full w-full" color={theme.buttonColor} />
        Link
      </span>
    );
  if (style === "outline") return <span className={cn(base, "rounded-full border-2")} style={{ borderColor: theme.buttonColor, color: theme.buttonColor }}>Link</span>;
  if (style === "rounded") return <span className={cn(base, "rounded-[6px] border-2 border-ink shadow-[3px_3px_0_#15161b]")} style={solid}>Link</span>;
  return <span className={cn(base, "rounded-full border border-[rgba(21,22,27,.15)]")} style={solid}>Link</span>;
}

export default function ThemeControls({ theme, set, art }: { theme: LinksTheme; set: Set; art: LinksArt[] }) {
  // Button samples sit on a swatch of the page background so white buttons still show.
  const bgArt = art.find((a) => a.id === theme.bgArtworkId) ?? art.find((a) => a.sensitive.length === 0);
  const sampleBg =
    theme.bg === "wash" || !bgArt
      ? { background: theme.washColor }
      : { backgroundImage: `linear-gradient(rgba(10,10,14,.3),rgba(10,10,14,.3)), url(${bgArt.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
  const lowContrast = theme.button !== "outline" && contrast(theme.buttonColor, theme.textColor) < 3;

  return (
    <div className="grid gap-7">
      <Group label="Background painting">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Background painting">
          <label className="relative cursor-pointer">
            <input type="radio" name="bgart" checked={!theme.bgArtworkId} onChange={() => set("bgArtworkId", null)} className="peer sr-only" />
            <span className="grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-line bg-wall p-1 text-center text-[13px] font-semibold leading-tight text-ink-2 peer-checked:border-solid peer-checked:border-ink peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan">
              Newest piece
            </span>
          </label>
          {art.map((a) => (
            <label key={a.id} className="relative cursor-pointer" title={a.title}>
              <input type="radio" name="bgart" checked={theme.bgArtworkId === a.id} onChange={() => set("bgArtworkId", a.id)} className="peer sr-only" aria-label={a.title} />
              <span className="block aspect-[3/4] overflow-hidden rounded-lg border-2 border-transparent ring-0 transition peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-sticker peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imageUrl} alt="" className={cn("h-full w-full object-cover", a.sensitive.length > 0 && "blur-[3px]")} />
              </span>
              {a.sensitive.length > 0 && <span className="absolute inset-x-1 bottom-1 rounded bg-[rgba(21,22,27,.8)] px-1 text-center text-[12px] font-bold text-white">Sensitive</span>}
            </label>
          ))}
        </div>
        {art.length === 0 && (
          <p className="text-[13px] text-ink-2">
            Your newest approved piece becomes the background. Until then it&apos;s a wash of color.{" "}
            <Link href="/studio/art/new" className="font-semibold text-ink underline underline-offset-2">Add a piece</Link>
          </p>
        )}
        {art.some((a) => a.id === theme.bgArtworkId && a.sensitive.length > 0) && (
          <p className="text-[13px] text-ink-2">Marked sensitive: blurred until a viewer chooses to see it.</p>
        )}
      </Group>

      <Group label="Treatment">
        <Segmented name="bg" value={theme.bg} options={BACKGROUNDS} onChange={(v) => set("bg", v)} />
      </Group>

      {theme.bg === "wash" ? (
        <PaintPicker label="Wash color" value={theme.washColor} onChange={(v) => set("washColor", v)} />
      ) : (
        <Group label="Shade over the painting">
          <Segmented
            name="scrim"
            value={theme.scrim}
            options={[
              { id: "none", label: "None" },
              { id: "soft", label: "Soft" },
              { id: "strong", label: "Strong" },
            ] as const}
            onChange={(v) => set("scrim", v)}
          />
        </Group>
      )}

      <Group label="Buttons">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Button style">
          {BUTTON_STYLES.map((b) => (
            <label key={b.id} className="cursor-pointer">
              <input type="radio" name="btnstyle" aria-label={`${b.label} buttons`} checked={theme.button === b.id} onChange={() => set("button", b.id)} className="peer sr-only" />
              <span className="grid gap-2 rounded-xl border-[1.5px] border-line bg-wall p-2.5 pb-2 text-center text-[13px] font-semibold text-ink-2 transition peer-checked:border-ink peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-[3px_3px_0_#15161b] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan">
                <span className="relative overflow-hidden rounded-lg px-2.5 py-2.5" style={sampleBg}>
                  <ButtonSample style={b.id} theme={theme} />
                </span>
                {b.label}
              </span>
            </label>
          ))}
        </div>
      </Group>

      <PaintPicker label={theme.button === "outline" ? "Line and text color" : "Button color"} value={theme.buttonColor} onChange={(v) => set("buttonColor", v)} />
      {theme.button !== "outline" && <PaintPicker label="Text color" value={theme.textColor} onChange={(v) => set("textColor", v)} />}
      {lowContrast && <p className="-mt-4 text-[13px] font-semibold text-coral">Hard to read. Pick colors further apart.</p>}

      <Group label="Fonts">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Fonts">
          {FONTS.map((f) => {
            const pair = FONT_PAIRS[f.id];
            return (
              <label key={f.id} className="cursor-pointer">
                <input type="radio" name="font" aria-label={`${f.label} fonts`} checked={theme.font === f.id} onChange={() => set("font", f.id)} className="peer sr-only" />
                <span className="grid gap-0.5 rounded-xl border-[1.5px] border-line bg-white p-3 transition peer-checked:border-ink peer-checked:shadow-[3px_3px_0_#15161b] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan">
                  <span className="text-[30px] leading-none text-ink" style={{ fontFamily: pair.display, fontWeight: pair.displayWeight, fontVariationSettings: pair.displaySettings ?? "normal" }}>
                    Aa
                  </span>
                  <span className="text-[13px] font-bold text-ink" style={{ fontFamily: pair.body }}>{f.label}</span>
                  <span className="text-[13px] leading-tight text-ink-2">{f.display} + {f.body}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Group>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border-[1.5px] border-line bg-[#f2f3ec99] px-4 py-3">
        <span className="grid leading-tight">
          <b className="text-[14px]">Show my newest prints</b>
          <span className="text-[13px] text-ink-2">3 tiles under Shop my prints</span>
        </span>
        <Switch checked={theme.showShop} onChange={(v) => set("showShop", v)} label="Show my newest prints" />
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-[1.5px] border-ink transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scan disabled:opacity-50",
        checked ? "bg-scan" : "bg-white"
      )}
    >
      <span className={cn("absolute h-[18px] w-[18px] rounded-full transition-all", checked ? "left-[24px] bg-white" : "left-[4px] bg-ink")} />
    </button>
  );
}
