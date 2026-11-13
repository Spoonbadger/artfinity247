// A one-line note for visitors who arrive from a printed code that no longer works.
//   kind "expired": on the artist's page (/@handle?expired=1)
//   kind "unknown": on the homepage (/?code=unknown)
export default function CodeNote({ kind, name }: { kind: "expired" | "unknown"; name?: string }) {
  return (
    <div className="bg-ink text-white" role="status">
      <p className="mx-auto flex max-w-[1240px] items-center gap-2.5 px-4 py-2.5 text-[14px] sm:px-6">
        <i className="paint-dab h-3 w-3" style={{ ["--dab" as string]: "#ffd43b" }} aria-hidden="true" />
        {kind === "expired"
          ? <span>This code has ended. Here&rsquo;s {name ? <b className="text-sticker">{name}</b> : "the artist"}&rsquo;s work.</span>
          : <span>We couldn&rsquo;t find that code. Have a look around.</span>}
      </p>
    </div>
  );
}
