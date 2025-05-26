"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MaxWidthWrapper } from "@/components/layout";
import { MinimalSection } from "@/components/sections";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getAppConfigs, getAppPages } from "@/db/query";
import Pagination from "@/components/CustomPagination";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const SearchPage = (): ReactNode => {
  const { title, banner, items_limit, slug: searchPageSlug } = AppPages.search;

  const router = useRouter();
  const searchParams = useSearchParams();

  const searchQueryKey = AppConfigs.search_query_key || "q";
  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const [totalItems, setTotalItems] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState<number>(items_limit || 10);

  useEffect(() => {
    setTotalItems(1); // Set Total Items
  }, []);

  useEffect(() => {
    setItemsPerPage(items_limit);

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10);
    const searchQuery = searchParams.get(searchQueryKey);

    setCurrentPage(queryPage > 0 ? queryPage : 1);

    if (!searchQuery) {
      router.push("/");
      return;
    }

    setSearchQuery(decodeURIComponent(searchQuery));
  }, [searchParams, searchQueryKey, queryPageKey, items_limit, router]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalItems / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  };

  return (
    <div>
      <title>{`${title || "Search"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MinimalSection className="page-banner" bg={banner}>
          <h1 className="text-center text-white">
            {title} - {searchQuery || ""}
          </h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>
      <section>
        <MaxWidthWrapper className="py-10 md:py-14">
          <div className="my-2 flex w-full md:my-4">
            <Pagination
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              className="hidden justify-end md:flex"
            />
          </div>
          <MinimalSection
            content="Search Items Here"
            className="grid min-h-52 place-content-center rounded-lg border"
          ></MinimalSection>
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
  );
};

export default SearchPage;
