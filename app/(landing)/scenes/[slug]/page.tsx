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
import { getAppConfigs, getAppPages, getProducts, getScene } from "@/db/query";
import { CollectionType, ProductType } from "@/types";

type ParamsPropsType = {
  slug: string;
};

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ScenePage = ({ params }: { params: ParamsPropsType }): ReactNode => {
  const { slug: encodedSlug } = params;
  const slug = decodeURIComponent(encodedSlug);

  const router = useRouter();
  const searchParams = useSearchParams();

  const [scene, setScene] = useState<CollectionType | null>(null);

  useEffect(() => {
    if (slug) {
      const fetchedScene = getScene({ slug });

      if (!fetchedScene) {
        router.push("/");
        return;
      }
      setScene((prev) => fetchedScene);
    }
  }, [slug, router]);

  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const { title, items_limit, sections } = AppPages.scene;
  const { slug: productsPageSlug } = AppPages.products;

  const [totalSceneProducts, setTotalSceneProducts] = useState<number>(0);
  const [paginatedProducts, setPaginatedProducts] = useState<ProductType[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(items_limit || 10);

  useEffect(() => {
    setItemsPerPage(items_limit);

    const queryPage = parseInt(searchParams.get(queryPageKey) || "1", 10);
    setCurrentPage(queryPage > 0 ? queryPage : 1);
  }, [searchParams, queryPageKey, items_limit]);

  useEffect(() => {
    const fetchProducts = () => {
      const start = (currentPage - 1) * itemsPerPage;
      const paginatedProducts = getProducts({
        ids: scene?.items || [],
        start,
        limit: start + itemsPerPage,
      });
      setPaginatedProducts(paginatedProducts);
    };

    fetchProducts();
    setTotalSceneProducts(getProducts({ ids: scene?.items || [] }).length);
  }, [scene, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalSceneProducts / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  };

  return (
    <div>
      <title>{`${title || "Scene"} - ${scene?.title || "Info"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MinimalSection
          className="page-banner"
          bg={scene?.img || ""}
          shadowOpacity="normal"
        >
          <h1 className="text-center text-white">{`${scene?.title} - ${title}`}</h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>
      <section>
        <MaxWidthWrapper className="space-y-4 py-10 md:space-y-6 md:py-14">
          <h2>{sections?.products?.title}</h2>
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
                      <SelectItem value="latest">latest</SelectItem>
                      <SelectItem value="price_low_to_high">
                        price: low to high
                      </SelectItem>
                      <SelectItem value="price_high_to_low">
                        price: high to low
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Pagination
                totalItems={totalSceneProducts}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                className="hidden justify-end md:flex"
              />
            </div>
          </div>
          {paginatedProducts.length > 0 ? (
            <div className="products-area grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
              {paginatedProducts.map((product) => (
                <Link
                  key={product._id}
                  href={`/${productsPageSlug}/${product.slug}`}
                >
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
              totalItems={totalSceneProducts}
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

export default ScenePage;
