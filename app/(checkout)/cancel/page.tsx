import Link from "next/link";

export const metadata = { title: "Checkout cancelled" };

export default function CancelPage() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 px-4 py-16 text-center md:py-24">
      <div className="h-28 w-[88px] rotate-[-4deg] rounded-[3px] border-[8px] border-ink bg-gallery shadow-[0_14px_28px_-10px_rgba(21,22,27,.45)]" aria-hidden />
      <h1 className="display text-[44px]">No charge made</h1>
      <p className="text-[17px] text-ink-2">Your print is still in your cart.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/cart" className="btn btn-blue">Back to cart</Link>
        <Link href="/art" className="btn btn-ghost">Keep looking</Link>
      </div>
    </div>
  );
}
