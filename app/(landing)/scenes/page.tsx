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
import { CollectionCard } from "@/components/cards";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import Pagination from "@/components/CustomPagination";
import { getAppConfigs, getAppPages, getScenes } from "@/db/query";
import { CollectionType } from "@/types";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const AllScenesPage = (): ReactNode => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const { title, banner, items_limit, slug: scenesPageSlug } = AppPages.scenes;

  const [scenes, setScenes] = useState<CollectionType[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(items_limit || 10);

  useEffect(() => {
    setItemsPerPage(items_limit);

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10);
    setCurrentPage(queryPage > 0 ? queryPage : 1);
  }, [searchParams, queryPageKey, items_limit]);

  useEffect(() => {
    const fetchScenes = () => {
      const start = (currentPage - 1) * itemsPerPage;
      const paginatedScenes = getScenes({
        start,
        limit: start + itemsPerPage,
      });
      setScenes(paginatedScenes);
    };

    fetchScenes();
  }, [currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(getScenes().length / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  };

  return (
    <div>
      <title>{`${title || "All Scenes"}: ${AppConfigs.app_name}`}</title>
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
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Pagination
                totalItems={getScenes().length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                className="hidden justify-end md:flex"
              />
            </div>
          </div>
          {scenes.length > 0 ? (
            <div className="scenes-area grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {scenes.map((collection) => (
                <Link
                  key={collection._id}
                  href={`/${scenesPageSlug}/${collection.slug}`}
                >
                  <CollectionCard
                    collection={collection}
                    showDescription={true}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="mb-6 w-full py-6 text-center text-lg capitalize md:mb-8 md:py-12 md:text-xl">
              {AppConfigs?.messages?.scenes?.not_found || "No Scenes Found"}
            </p>
          )}
          <div className="pagination-area flex items-center justify-center py-6">
            <Pagination
              totalItems={getScenes().length}
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

export default AllScenesPage;
