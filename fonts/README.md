# Fonts

Bundled with the site so builds never download from Google Fonts (Next.js 14's Google loader crashed on Vercel
when Google sent font addresses it didn't expect). Loaded with `next/font/local`, which self-hosts and preloads them.

Latin subset only, from Google Fonts. All are under the SIL Open Font License 1.1 (https://openfontlicense.org),
which allows bundling them with the site. Variable fonts cover the weight range in the file name.

| File | Family | Used in |
| --- | --- | --- |
| bricolage-grotesque-200-800.woff2 | Bricolage Grotesque (wght, wdth, opsz) | app/layout.tsx, display font |
| instrument-sans-400-700.woff2 | Instrument Sans | app/layout.tsx, body font |
| fraunces-600-800.woff2 | Fraunces | components/links/fonts.ts |
| caveat-brush-400.woff2 | Caveat Brush | components/links/fonts.ts |
| dm-serif-display-400.woff2 | DM Serif Display | components/links/fonts.ts |
| dm-sans-100-1000.woff2 | DM Sans | components/links/fonts.ts |
| mrs-saint-delafield-400.woff2 | Mrs Saint Delafield | app/certificate/CertificateSheet.tsx |
| libre-bodoni-400-700.woff2 | Libre Bodoni | app/dev/brand-preview/palettes.ts |
| roboto-mono-400-700.woff2 | Roboto Mono | app/dev/brand-preview/palettes.ts |
