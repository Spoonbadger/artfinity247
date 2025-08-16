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

  useEffect(() => {
    setItemsPerPage(items_limit)

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10)
    setCurrentPage(queryPage > 0 ? queryPage : 1)
  }, [searchParams, queryPageKey, items_limit])

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/artists?page=${currentPage}&limit=${itemsPerPage}`, { cache: "no-store" });
      if (!res.ok) { 
        setSellers([])
        setTotalArtists(0)
        return 
      }
      const { artists, total } = await res.json()
      setSellers(artists)
      setTotalArtists(total)
    })()
  }, [currentPage, itemsPerPage])

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalArtists / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  }

  return (
    <div>
      <title>All Artists: Artistfinity</title>
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
              <div className="filter-area relative isolate">
                <Select>
                  <SelectTrigger className="max-w-[180px] capitalize">
                    <SelectValue
                      className="capitalize"
                      placeholder="Default Sorting"
                    />
                  </SelectTrigger>
                  <SelectContent className="capitalize">
                    <SelectGroup>
                      <SelectLabel>Sort By</SelectLabel>
                      <SelectItem value="popularity">popularity</SelectItem>
                      <SelectItem value="rating_average">
                        average rating
                      </SelectItem>
                      <SelectItem value="verified">verified</SelectItem>
                      <SelectItem value="new_to_old">new to old</SelectItem>
                      <SelectItem value="old_to_new">old to new</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
          {sellers.length > 0 ? (
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
              totalItems={getSellers().length}
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
