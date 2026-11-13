// Hidden SVG symbols for the painterly marks. Rendered once in the root layout.
// Use them through <BrushStroke /> and <Swatch /> from "@/components/af/Brush".
export default function BrushDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="af-stroke" viewBox="0 0 300 40" preserveAspectRatio="none">
          <path d="M5 21C38 9 92 25 150 15S252 7 295 16L293 29C246 22 170 35 108 31S30 31 8 33Z" fill="currentColor" opacity=".92" />
          <path d="M14 18C80 11 190 22 286 13M10 27C90 24 200 32 288 24" stroke="currentColor" strokeWidth="2.4" fill="none" opacity=".45" strokeLinecap="round" />
          <path d="M286 14l9-3M288 27l8 3M6 22l-5 2" stroke="currentColor" strokeWidth="1.6" opacity=".6" strokeLinecap="round" />
        </symbol>
        <symbol id="af-swatch" viewBox="0 0 200 70" preserveAspectRatio="none">
          <path d="M2 9C30 1 72 13 112 6S178 1 198 10V60C170 69 122 57 80 65S22 60 2 66Z" fill="currentColor" />
          <path d="M10 22C70 16 140 26 192 19M8 44C80 39 150 50 194 42" stroke="#fff" strokeWidth="3" fill="none" opacity=".18" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}
