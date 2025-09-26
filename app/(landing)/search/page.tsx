"use client"

import { ReactNode, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MaxWidthWrapper } from "@/components/layout"
import { MinimalSection } from "@/components/sections"
import PageBreadcrumb from "@/components/PageBreadcrumb"
import { getAppConfigs, getAppPages } from "@/db/query"
import Pagination from "@/components/CustomPagination"
import Link from "next/link"
import Image from "next/image"

const AppConfigs = getAppConfigs()
const AppPages = getAppPages()

type Artwork = { slug: string; title: string; imageUrl: string | null; artist: { name: string; slug: string } }
type Artist = { slug: string; name: string; profileImage: string | null }

const SearchPage = (): ReactNode => {
  const { title, banner, items_limit } = AppPages.search
  const router = useRouter()
  const searchParams = useSearchParams()

  const searchQueryKey = AppConfigs.search_query_key || "q"
  const queryPageKey = AppConfigs.pagination_query_key || "page"

  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(items_limit || 10)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setItemsPerPage(items_limit)

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10)
    const query = searchParams.get(searchQueryKey)

    setCurrentPage(queryPage > 0 ? queryPage : 1)

    if (!query) {
      router.push("/")
      return
    }

    setSearchQuery(decodeURIComponent(query))
  }, [searchParams, searchQueryKey, queryPageKey, items_limit, router])

  useEffect(() => {
    if (!searchQuery) return
    setLoading(true)

    fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}&limit=${itemsPerPage}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setArtworks(data.artworks || [])
        setArtists(data.artists || [])
        setTotalItems(data.total || 0)
      })
      .finally(() => setLoading(false))
  }, [searchQuery, currentPage, itemsPerPage])

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalItems / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}&${searchQueryKey}=${encodeURIComponent(searchQuery || "")}`)
    } else {
      router.push(`?${queryPageKey}=1`)
    }
  }

  return (
    <div>
      <title>{`${title || "Search"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MinimalSection className="page-banner" bg={banner}>
          <h1 className="text-center text-white">
            {title} – {searchQuery || ""}
          </h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>

      <section>
        <MaxWidthWrapper className="py-10 md:py-14">
          {loading ? (
            <p>Loading results…</p>
          ) : (
            <>
              <h2 className="font-semibold mb-4 text-lg">Artworks</h2>
              {artworks.length === 0 ? (
                <p>No artworks found.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {artworks.map((a) => (
                    <li key={a.slug} className="border rounded p-2">
                      <Link href={`/art/${a.slug}`}>
                        {a.imageUrl && (
                          <Image
                            src={a.imageUrl}
                            alt={a.title}
                            width={300}
                            height={200}
                            className="h-40 w-full object-cover rounded"
                          />
                        )}
                        <div className="mt-2 font-medium">{a.title}</div>
                        <div className="text-sm text-gray-600">by {a.artist.name}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="font-semibold mt-10 mb-4 text-lg">Artists</h2>
              {artists.length === 0 ? (
                <p>No artists found.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {artists.map((a) => (
                    <li key={a.slug} className="border rounded p-2">
                      <Link href={`/artists/${a.slug}`}>
                        {a.profileImage && (
                          <Image
                            src={a.profileImage}
                            alt={a.name}
                            width={150}
                            height={150}
                            className="h-32 w-full object-cover rounded-full mx-auto"
                          />
                        )}
                        <div className="mt-2 text-center font-medium">{a.name}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="pagination-area flex items-center justify-center py-6">
            <Pagination
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>
        </MaxWidthWrapper>
      </section>
    </div>
  )
}

export default SearchPage