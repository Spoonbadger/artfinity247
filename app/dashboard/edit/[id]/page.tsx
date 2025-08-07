'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ArtworkUploadForm from '@/components/forms/ArtworkUploadForm'

const EditArtworkPage = () => {
  const { id } = useParams()
  const [artwork, setArtwork] = useState(null)

  useEffect(() => {
    const fetchArtwork = async () => {
      const res = await fetch(`/api/artworks/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setArtwork(data)
    }

    fetchArtwork()
  }, [id])

  if (!artwork) return <p>Loading...</p>

  return <ArtworkUploadForm artwork={artwork} />
}

export default EditArtworkPage
