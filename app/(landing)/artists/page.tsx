"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaxWidthWrapper } from "@/components/layout";
import { MinimalSection } from "@/components/sections";
import { UserCard } from "@/components/cards";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import Pagination from "@/components/CustomPagination";
import { getAppConfigs, getAppPages, getSellers } from "@/db/query";
import { UserType } from "@/types";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ArtistsPage = (): ReactNode => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const {
    title,
    banner,
    items_limit,
    slug: sellersPageSlug,
  } = AppPages.sellers;

  const [sellers, setSellers] = useState<UserType[]>([])
  const [totalArtists, setTotalArtists] = useState(0)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(items_limit || 10);
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<"name_az" | "name_za" | "random">("name_az")

  useEffect(() => {
    let ignore = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/artists?page=${currentPage}&limit=${itemsPerPage}&sort=${sort}`,
          { cache: "no-store" }
        )
        if (!res.ok) { if (!ignore) { setSellers([]); setTotalArtists(0) } ; return }
        const { artists, total } = await res.json()
        if (!ignore) { setSellers(artists || []); setTotalArtists(total || 0) }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => { ignore = true }
  }, [currentPage, itemsPerPage, sort])


  useEffect(() => {
    setItemsPerPage(items_limit)

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10)
    setCurrentPage(queryPage > 0 ? queryPage : 1)
  }, [searchParams, queryPageKey, items_limit])

  
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalArtists / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  }

  return (
    <div>
      <title>All Artists: Artfinity</title>
      <section>
        <MinimalSection className="page-banner" bg={banner}>
          <h1 className="text-center text-white">{title}</h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>
      <section>
        <MaxWidthWrapper className="space-y-4 py-10 md:space-y-6 md:py-14">
          <div className="page-top grid grid-cols-1 items-center justify-between gap-x-4 gap-y-2 space-y-2 md:grid-cols-2 md:gap-6">
            <div>
              <div className="filter-area relative isolate text-theme-secondary-500">
                <select
                  value={sort}
                  onChange={(e) =>
                    setSort(e.target.value as "name_az" | "name_za" | "random")
                  }
                  className="max-w-[180px] rounded border px-2 py-1 capitalize text-theme-secondary-500"
                >
                  <option value="name_az">Name A–Z</option>
                  <option value="name_za">Name Z–A</option>
                  <option value="random">Random</option>
                </select>
              </div>
            </div>
            <div>
              <Pagination
                totalItems={totalArtists}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                className="hidden justify-end md:flex"
              />
            </div>
          </div>
          
          {loading ? (
            <p className="mb-6 w-full py-6 text-center text-lg md:mb-8 md:py-12">Loading…</p>
          ) : sellers.length > 0 ? (
            <div className="sellers-area grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {sellers.map((user) => (
                <Link key={user.id} href={`/${sellersPageSlug}/${user.slug}`}>
                  <UserCard user={user} showBio={true} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="mb-6 w-full py-6 text-center text-lg capitalize md:mb-8 md:py-12 md:text-xl">
              {AppConfigs?.messages?.sellers?.not_found || "No Sellers Found"}
            </p>
          )}
          <div className="pagination-area flex items-center justify-center py-6">
            
            <Pagination
              totalItems={totalArtists}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>
        </MaxWidthWrapper>
      </section>
    </div>
  );
};

export default ArtistsPage;