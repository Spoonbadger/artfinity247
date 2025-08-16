// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="p-6 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-4">
        The page you’re looking for doesn’t exist.
      </p>
      <Link href="/" className="inline-block rounded bg-black px-4 py-2 text-white">
        Go home
      </Link>
    </main>
  )
}