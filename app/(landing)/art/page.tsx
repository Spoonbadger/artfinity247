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
import { ProductCard } from "@/components/cards";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import Pagination from "@/components/CustomPagination";
import { getAppConfigs, getAppPages } from "@/db/query";
import { ProductType } from "@/types";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ArtsPage = (): ReactNode => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const {
    title,
    banner,
    items_limit,
    slug: productsPageSlug,
  } = AppPages.products;

  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [paginatedProducts, setPaginatedProducts] = useState<ProductType[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(items_limit || 10);
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState("newest")


  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const page = parseInt(searchParams.get(queryPageKey) || "1", 10);
        const limit = items_limit || 12;

        const res = await fetch(`/api/artworks?page=${page}&limit=${limit}&sort=${sort}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const { artworks, total } = await res.json();
          setPaginatedProducts(artworks);
          setTotalProducts(total ?? artworks.length);
          setCurrentPage(page);
          setItemsPerPage(limit);
        } else {
          setPaginatedProducts([]);
          setTotalProducts(0);
        }
      } catch {
        setPaginatedProducts([]);
        setTotalProducts(0);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [searchParams, items_limit, queryPageKey, sort])


  useEffect(() => {
    setItemsPerPage(items_limit);

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10);
    setCurrentPage(queryPage > 0 ? queryPage : 1);
  }, [searchParams, queryPageKey, items_limit])

  useEffect(() => {
  const run = async () => {
    const page = parseInt(searchParams.get(queryPageKey) || "1", 10);
    const limit = items_limit || 12;

    try {
      const res = await fetch(`/api/artworks?page=${page}&limit=${limit}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        // If your API currently requires auth or returns a different shape,
        // you’ll see it here. We’ll adjust after this step if needed.
        setPaginatedProducts([]);
        setTotalProducts(0);
        setCurrentPage(page);
        setItemsPerPage(limit);
        return;
      }

      const { artworks, total } = await res.json()
      setPaginatedProducts(artworks);
      setTotalProducts(total ?? artworks.length);
      setCurrentPage(page);
      setItemsPerPage(limit);
    } catch {
      setPaginatedProducts([]);
      setTotalProducts(0);
      setCurrentPage(1);
    }
  };

  run();
  // dependencies: rerun when the query string page changes or items_limit changes
}, [searchParams, items_limit, queryPageKey])


  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalProducts / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  };

  return (
    <div>
      <title>{`${title || "All Art"}: ${AppConfigs.app_name}`}</title>
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

              <div className="flex mb-4 text-theme-secondary-600">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="newest">Latest</option>
                  <option value="oldest">The Ogs</option>
                  <option value="random">Random</option>
                  {/* <option value="popular">Most Popular</option> */}
                </select>
              </div>
            </div>
            <div>
              <Pagination
                totalItems={totalProducts}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                className="hidden justify-end md:flex"
              />
            </div>
          </div>
          {loading ? (
            <p className="mb-6 w-full py-6 text-center text-lg md:mb-8 md:py-12 text-theme-secondary-500">
              Loading…
            </p>
          ) : paginatedProducts.length > 0 ? (
            <div className="products-area grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {paginatedProducts.map((product) => (
                <Link key={product.id} href={`/art/${product.slug}`}>
                  <ProductCard product={product} showSeller={true} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="mb-6 w-full py-6 text-center text-lg capitalize md:mb-8 md:py-12 md:text-xl">
              {AppConfigs?.messages?.products?.not_found || "No Products Found"}
            </p>
          )}
          <div className="pagination-area flex items-center justify-center py-6">
            <Pagination
              totalItems={totalProducts}
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

export default ArtsPage;