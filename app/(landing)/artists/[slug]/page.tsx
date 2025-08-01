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
import { Button } from '@/components/ui/button'
import { MaxWidthWrapper } from "@/components/layout";
import { ImageWithText } from "@/components/sections";
import { ProductCard } from "@/components/cards";
import { ReviewCarousel } from "@/components/carousels";
import Pagination from "@/components/CustomPagination";
import SocialAccountLinks from "@/components/SocialAccountLinks";
import {
  getAppConfigs,
  getAppPages,
  getProducts,
  getReviews,
  getSeller,
} from "@/db/query";
import { UserType, ProductType, ReviewType } from "@/types";
import { useUser } from '@/components/contexts/UserProvider'
import { toast } from 'sonner'

type ParamsPropsType = {
  slug: string;
};

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const SellerPage = ({ params }: { params: ParamsPropsType }): ReactNode => {
  const { slug: encodedSlug } = params;
  const slug = decodeURIComponent(encodedSlug);
  const { currentUser } = useUser()
  const isOwner = currentUser?.slug === slug

  const router = useRouter();
  const searchParams = useSearchParams();

  const [seller, setSeller] = useState<UserType | null>(null);
  const [reviews, setReviews] = useState<ReviewType[]>([]);

  const [isEditing, setIsEditing] = useState(false)
  const [bioDraft, setBioDraft] = useState(seller?.bio || "")

  useEffect(() => {
    if (slug) {
      const fetchedSeller = getSeller({ slug });

      if (!fetchedSeller) {
        router.push("/");
        return;
      }

      setSeller((prev) => fetchedSeller);
    }
    setReviews((prev) =>
      getReviews({
        item_ids: seller?._id ? [seller._id] : [],
        types: ["seller"],
      }),
    );
  }, [slug, seller?._id, router]);

  const queryPageKey = AppConfigs.pagination_query_key || "page";

  const { title, items_limit, sections } = AppPages.seller;
  const { slug: productsPageSlug } = AppPages.products;

  const [totalSellerProducts, setTotalSellerProducts] = useState<number>(0);
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
        seller_ids: seller?._id ? [seller?._id] : [],
        start,
        limit: start + itemsPerPage,
      });
      setPaginatedProducts(paginatedProducts);
    };

    fetchProducts();
    setTotalSellerProducts(
      getProducts({ ids: seller?._id ? [seller?._id] : [] }).length,
    );
  }, [seller, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= Math.ceil(totalSellerProducts / itemsPerPage)) {
      router.push(`?${queryPageKey}=${page}`);
    } else {
      router.push(`?${queryPageKey}=1`);
    }
  };

  const handleSaveBio = async () => {
    try {
      const res = await fetch('/api/artists/update-bio', {
        method: 'POST',
        headers: { 'Content-Type': '/application/json' },
        body: JSON.stringify({ bio: bioDraft })
      })

      if (!res.ok) throw new Error(await res.text())

      toast.success('Bio updated')
      setIsEditing(false)

    } catch (err) {
      console.error('Failed to update bio', err)
      toast.error('Failed to update bio')
    }
  }

  return (
    <div>
      <title>{`${title || "Artist"} - ${seller?.seller_name || "Info"}: ${AppConfigs.app_name}`}</title>
      <section className="my-12 md:my-16">
        <MaxWidthWrapper>
          <ImageWithText
            img={
              seller?.profile_picture ||
              "/uploads/users/generic-artist-profile-picture.webp"
            }
            title={seller?.seller_name || ""}
            imgAlign={"left"}
            txtAlign={"left"}
            imgLoading="eager"
            className="[&_.area-content]:self-center [&_.area-image]:max-h-[60vh] [&_.area-image]:min-h-96 [&_.area-image]:object-contain"
          >
            {
              isOwner && isEditing ? (
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  className='w-full rounded border p-2 text-sm'
                />
              ) : (seller?.bio || "")
            }
            {isOwner && (
              <div className='mt-2'>
                {isEditing ? (
                  <Button onClick={handleSaveBio}>save</Button>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>edit</Button>
                )}
              </div>
            )}
            <SocialAccountLinks
              links={seller?.social_accounts || []}
              className="justify-center md:justify-start"
            />
            <div className="seller-address-info mt-8 md:mt-12">
              <h4>
                Based in:{" "}
                <span className="font-tertiary text-xs font-normal text-slate-800 dark:text-slate-200 md:text-sm">
                  {seller?.city || "unknown"}
                </span>
              </h4>
            </div>
          </ImageWithText>
        </MaxWidthWrapper>
      </section>
      <section className="my-12 md:my-16">
        <MaxWidthWrapper className="space-y-4 md:space-y-6">
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
                totalItems={totalSellerProducts}
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
                  <ProductCard product={product} />
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
              totalItems={totalSellerProducts}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Seller Reviews */}
      <section>
        <MaxWidthWrapper className="py-6 md:py-8">
          <ReviewCarousel
            title={sections?.reviews?.title || "Reviews for this Seller"}
            reviews={reviews}
            showLink={false}
            className="[&_.area-title]:md:text-3xl"
            notFoundMsg={AppConfigs?.messages?.reviews?.not_found}
          />
        </MaxWidthWrapper>
      </section>
    </div>
  );
};

export default SellerPage;
