// The project folder at runtime (same value as process.cwd()), for paths built from a runtime value such as a
// stored file name or an env var.
//
// Why not process.cwd() directly: the build's file tracer reads path.join(process.cwd(), <unknown>) as "this code
// may open any file in the project" and copies the whole project into every server function that imports it.
// On Vercel that made functions over 1 GB (the limit is 250 MB). Reading cwd through a variable keeps the tracer
// from guessing. Files a route really needs at runtime go in next.config.mjs → outputFileTracingIncludes.
// Static paths (path.join(process.cwd(), "data", "x.json")) are fine with process.cwd(): the tracer ships just that file.
const proc = globalThis.process;

export function projectRoot(): string {
  return proc.cwd();
}
