// Anything else under /api/public/v1 gets the same JSON error shape.
import { apiError, methodNotAllowed, preflight } from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

export function GET() {
  return apiError("not_found", "No such endpoint. See theartfinity.com/developers.", 404);
}
export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
