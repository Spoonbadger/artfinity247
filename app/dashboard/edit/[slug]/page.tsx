'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ArtworkUploadForm from '@/components/forms/ArtworkUploadForm'

const EditArtworkPage = () => {
  const { slug } = useParams()
  const [artwork, setArtwork] = useState(null)

  useEffect(() => {
    const fetchArtwork = async () => {
      const res = await fetch(`/api/artworks/${slug}`)
      if (!res.ok) return
      const data = await res.json()
      setArtwork(data)
    }

    fetchArtwork()
  }, [slug])

  if (!artwork) return <p className="text-theme-secondary">Loading...</p>

  return <ArtworkUploadForm artwork={artwork} />
}

export default EditArtworkPage
