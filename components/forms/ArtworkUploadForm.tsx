'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Artwork } from '@prisma/client'
import { basePrices } from '@/lib/artwork_price'
import { toast } from 'sonner'


const ArtworkUploadForm = ({ artwork }: { artwork? : Artwork }) => {
    const [title, setTitle] = useState(artwork?.title || '')
    const [description, setDescription] = useState(artwork?.description || '')
    const [image, setImage] = useState<File | null>(null)
    const [markupSmall, setMarkupSmall] = useState(artwork?.markupSmall ?? 0)
    const [markupMedium, setMarkupMedium] = useState(artwork?.markupMedium ?? 0)
    const [markupLarge, setMarkupLarge] = useState(artwork?.markupLarge ?? 0)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const [errorSmall, setErrorSmall] = useState(false)
    const [errorMedium, setErrorMedium] = useState(false)
    const [errorLarge, setErrorLarge] = useState(false)

    const router = useRouter()

    useEffect(() => {
        if (artwork?.imageUrl) {
            setPreview(artwork.imageUrl)
        }
    }, [artwork])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (!title.trim() || !image || !description) {
            alert('Please complete all required fields')
            setLoading(false)
            return
        }

        console.log("Submitting with image:", image)


        const formData = new FormData(e.currentTarget as HTMLFormElement)

        if (image instanceof File) {
          formData.set('image', image)
        }

        if (title) formData.set('title', title)
        if (description) formData.set('description', description)
        if (artwork?.id) formData.set('artworkId', artwork.id)

        formData.append('markupSmall', String(markupSmall))
        formData.append('markupMedium', String(markupMedium))
        formData.append('markupLarge', String(markupLarge))


        const endpoint = artwork
          ?  `/api/artworks/${artwork.slug}`
          :  `/api/artworks/upload`

        const method = artwork ? 'PUT' : 'POST'

        const res = await fetch(endpoint, {
            method,
            body: formData
        })
        setLoading(false)

        if (res.ok) {
            const data = await res.json()
            toast("- Artwork uploaded!")
            router.push(`/artists/${data.artistSlug}`)
        } else {
            alert('Upload failed')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImage(file)

    // Only preview if browser can render it
    if (!file.type.includes("heic")) {
        const url = URL.createObjectURL(file)
        setPreview(url)
        } else {
            setPreview(null)
            toast("HEIC preview not supported. Image will appear after upload.")
        }
    }

    return (
        <form onSubmit={handleSubmit} className='space-y-4 max-w-md mx-auto'>
            <input
              type='text'
              name="upload-art-title"
              placeholder='Title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className='text-theme-secondary-600 w-full p-2 border rounded'
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
                name="upload-art-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-theme-secondary-600 w-full p-2 border rounded h-64"
            />
            {/* Pricing section */}
            <div className="mt-6 space-y-3">
                <p className="text-sm font-semibold">
                    Set your print prices
                </p>
                <p className="text-xs text-gray-500">
                    These are the final prices buyers see. You can increase them above the default base prices.
                </p>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-theme-secondary-600">
                    Small print price ($)
                    {/* <span className="ml-2 text-xs text-gray-500">
                        Base ${basePrices.small / 100}
                    </span> */}
                    </label>
                    <input
                    type="number"
                    className="w-full p-2 border rounded text-theme-secondary-600"
                    value={(basePrices.small + markupSmall) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        const markup = value - basePrices.small
                        setMarkupSmall(Math.max(0, value - basePrices.small))
                        setErrorSmall(markup < 0)
                    }}
                    />
                    {errorSmall && (
                    <p className="text-red-500 text-xs">
                        Must be ≥ ${basePrices.small / 100}
                    </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-theme-secondary-600">
                    Medium print price ($)
                    {/* <span className="ml-2 text-xs text-gray-500">
                        Base ${basePrices.medium / 100}
                    </span> */}
                    </label>
                    <input
                    type="number"
                    className="w-full p-2 border rounded text-theme-secondary-600"
                    value={(basePrices.medium + markupMedium) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        const markup = value - basePrices.medium
                        setMarkupMedium(Math.max(0, value - basePrices.medium))
                        setErrorMedium(markup < 0)
                    }}
                    />
                    {errorMedium && (
                    <p className="text-red-500 text-xs">
                        Must be ≥ ${basePrices.medium / 100}
                    </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-theme-secondary-600">
                    Large print price ($)
                    {/* <span className="ml-2 text-xs text-gray-500">
                        Base ${basePrices.large / 100}
                    </span> */}
                    </label>
                    <input
                    type="number"
                    className="w-full p-2 border rounded text-theme-secondary-600"
                    value={(basePrices.large + markupLarge) / 100}
                    onChange={(e) => {
                        const value = Math.round(parseFloat(e.target.value) * 100)
                        const markup = value - basePrices.large
                        setMarkupLarge(Math.max(0, value - basePrices.large))
                        setErrorLarge(markup < 0)
                    }}
                    />
                    {errorLarge && (
                    <p className="text-red-500 text-xs">
                        Must be ≥ ${basePrices.large / 100}
                    </p>
                    )}
                </div>
            </div>
            {errorLarge && <p className='text-red-500 text-sm'>Must be ≥ ${basePrices.large /100}</p>}

            <Button type='submit' disabled={
                loading ||
                !title.trim() ||
                !description ||
                errorSmall ||
                errorMedium ||
                errorLarge
                }>
                {loading ? 'Uploading... ' : 'Upload'}
            </Button>
        </form>
    )
}

export default ArtworkUploadForm