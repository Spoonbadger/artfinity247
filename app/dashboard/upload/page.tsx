'use client'

import ArtworkUploadForm from '@/components/forms/ArtworkUploadForm'

export const dynamic = "force-dynamic"

export default function UploadArtworkPage() {
  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Upload New Artwork</h1>
      <ArtworkUploadForm />
    </div>
  )
}
