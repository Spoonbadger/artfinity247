// Shared by the /api/admin/social routes.
import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (error: string, code = "invalid_input", status = 400) => NextResponse.json({ error, code }, { status });
