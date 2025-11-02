// lib/auth.ts (server-side)
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

type JwtUser = { id: string; slug?: string; email?: string; role?: "ADMIN" | "USER" };

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function getUserFromCookie(): Promise<JwtUser | null> {
  const token = cookies().get("auth-token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as JwtUser;
  } catch {
    return null;
  }
}

// keep if you also want header auth for API clients
export async function getUserFromRequestAuthHeader(req: Request): Promise<JwtUser | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as JwtUser;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<JwtUser> {
  const u = await getUserFromCookie();
  if (!u?.id) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return u;
}

export async function requireAdmin(): Promise<JwtUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
  return u;
}
