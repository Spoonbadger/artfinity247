// GET /api/studio/customers : the signed-in artist's customers (paid retail orders of their work), newest first.
// ?email= returns one customer with their orders. Emails are masked in the list.
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { getCustomer, getCustomers, maskEmail } from "@/app/studio/customers/_lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const email = new URL(req.url).searchParams.get("email");
  if (email) {
    const customer = await getCustomer(user.id, email);
    return customer ? NextResponse.json({ customer }) : NextResponse.json({ error: "Customer not found.", code: "not_found" }, { status: 404 });
  }
  const customers = await getCustomers(user.id);
  return NextResponse.json({
    customers: customers.map(({ email: e, orders, ...c }) => ({ ...c, email: maskEmail(e), orders: orders.length })),
  });
}
