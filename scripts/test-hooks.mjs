// Loaded before every test file (`pnpm test` passes --import ./scripts/test-hooks.mjs). It lets plain `node --test`
// load the app's TypeScript the way Next does: "@/lib/x" means <repo>/lib/x, and imports may leave off ".ts".
// Node itself strips the TypeScript types (--experimental-transform-types). Test-only; the app never loads this.
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const EXTS = [".ts", ".tsx", ".mjs", ".js"];

function findFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) if (existsSync(base + ext)) return base + ext;
  for (const ext of EXTS) if (existsSync(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith("@/")) base = root + specifier.slice(2);
    // Relative imports from the app's own TypeScript only; packages in node_modules resolve as usual.
    else if (/^\.\.?\//.test(specifier) && /^file:.*\.tsx?$/.test(context.parentURL ?? "") && !context.parentURL.includes("/node_modules/")) {
      base = fileURLToPath(new URL(specifier, context.parentURL));
    }
    const file = base && findFile(base);
    if (file) return nextResolve(pathToFileURL(file).href, context);
    return nextResolve(specifier, context);
  },
});
