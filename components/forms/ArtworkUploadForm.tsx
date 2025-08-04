'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'

const ArtworkUploadForm = () => {
    const [title, setTitle] = useState('')
    const [image, setImage] = useState('')
    const [price, setPrice] = useState('') // I imagine i'll be updating this at some point later
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const res = await fetch('/api/artworks/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, image, price })
        })

        setLoading(false)
        if (res.ok) {
            router.refresh()
        } else {
            alert('Upload failed')
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
              type='text'
              placeholder='image URL'
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className='w-full p-2 border rounded'
            />
            <input
              type='number'
              placeholder='Price'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className='w-full p-2 border rounded'
            />
            <Button type='submit' disabled={loading}>
                {loading ? 'Uploading... ' : 'Upload'}
            </Button>
        </form>
    )
}

export default ArtworkUploadForm