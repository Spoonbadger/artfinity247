export async function getProduct({ slug }: { slug: string}) {
    const res = await fetch(`/api/artworks/${slug}`, { cache: 'no-store'})
    if (!res.ok) return null
    return res.json()
}