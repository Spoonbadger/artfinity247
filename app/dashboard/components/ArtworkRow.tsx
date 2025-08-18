'use client'

import Link from 'next/link'

type Artwork = { id: string; slug: string; title: string }

export default function ArtworkRow({
  art,
  onDelete,
}: {
  art: Artwork
  onDelete?: (slug: string) => void
}) {
  return (
    <div className="flex items-center justify-between border-b py-2">
      <div className="font-medium">{art.title}</div>
      <div className="flex gap-2">
        <Link href={`/dashboard/edit/${art.slug}`} className="btn">Edit</Link>

        {onDelete && (
          <button onClick={() => onDelete(art.slug)} className="btn btn-danger">
            Delete
          </button>
        )}

        <button
          onClick={() => window.open(`/api/artworks/${art.slug}/qr`, '_blank', 'noopener')}
          className="btn"
        >
          View QR Card
        </button>

        <button
          onClick={() => window.open(`/api/artworks/${art.slug}/qr?download=1`, '_blank', 'noopener')}
          className="btn"
        >
          Download QR Card
        </button>
      </div>
    </div>
  )
}
