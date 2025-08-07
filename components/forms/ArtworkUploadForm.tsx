'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Artwork } from '@prisma/client'
import { basePrices } from '@/lib/artwork_price'


const ArtworkUploadForm = ({ artwork }: { artwork? : Artwork }) => {
    const [title, setTitle] = useState(artwork?.title || '')
    const [description, setDescription] = useState(artwork?.description || '')
    const [image, setImage] = useState<File | null>(null)
    const [markupSmall, setMarkupSmall] = useState(artwork?.markupSmall ?? 0)
    const [markupMedium, setMarkupMedium] = useState(artwork?.markupMedium ?? 0)
    const [markupLarge, setMarkupLarge] = useState(artwork?.markupLarge ?? 0)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)

    const router = useRouter()

    useEffect(() => {
        if (artwork?.imageUrl) {
            setPreview(artwork.imageUrl)
        }
    }, [artwork])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (!title.trim() || !price || !preview || !description) {
            alert('Please complete all required fields')
            setLoading(false)
            return
        }

        const formData = new FormData(e.currentTarget as HTMLFormElement)

        if (image instanceof File) {
          formData.set('image', image)
        }

        if (title) formData.set('title', title)
        if (description) formData.set('description', description)
        if (price) formData.set('price', String(price))
        if (artwork?.id) formData.set('artworkId', artwork.id)

        const endpoint = artwork
          ?  `/api/artworks/[id]`
          :  `/api/artworks/upload`

        const method = artwork ? 'PUT' : 'POST'

        const res = await fetch(endpoint, {
            method,
            body: formData
        })
        setLoading(false)

        if (res.ok) {
            const data = await res.json()
            console.log("uploaded??: ", data)
            router.push(`/artists/${data.artwork.artworkId}`)
        } else {
            alert('Upload failed')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setPreview(url)
            setImage(file)
        }
    }

    return (
        <form onSubmit={handleSubmit} className='space-y-4 max-w-md'>
            <input
              type='text'
              placeholder='Title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className='w-full p-2 border rounded'
            />
            <input
              type='file'
              accept='image/*'
              name='image'
              placeholder='image URL'
              onChange={handleFileChange}
              className='w-full p-2 border rounded'
            />
            {preview && (
                <img src={preview} alt="Image preview" className="h-40 w-auto rounded border border-gray-300" />
            )}
            <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border rounded"
            />
            <div>
                <label>Small Print Price $</label>
                <input
                    type="number"
                    value={(basePrices.small + markupSmall) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        setMarkupSmall(Math.max(0, value - basePrices.small))
                    }}
                />
            </div>
            <div>
                <label>Medium Print Price $</label>
                <input
                    type='number'
                    value={(basePrices.medium + markupMedium) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        setMarkupMedium(Math.max(0, value - basePrices.medium))
                    }}
                />
            </div>
            <div>
                <label>Large Print Price $</label>
                <input
                    type='number'
                    value={(basePrices.large + markupLarge) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        setMarkupLarge(Math.max(0, value - basePrices.large))
                    }}
                />
            </div>
            <Button type='submit' disabled={loading || !title.trim() || !description || !price }>
                {loading ? 'Uploading... ' : 'Upload'}
            </Button>
        </form>
    )
}

export default ArtworkUploadForm