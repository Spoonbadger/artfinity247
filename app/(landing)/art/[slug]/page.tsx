"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InnerImageZoom from "react-inner-image-zoom";
import "react-inner-image-zoom/lib/InnerImageZoom/styles.css";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCart } from "@/components/contexts";
import { CheckCircle, StarIcon } from "lucide-react";
import { MaxWidthWrapper } from "@/components/layout";
import { ProductsCarousel, ReviewCarousel } from "@/components/carousels";
import { Label, Radio, RadioGroup } from "@headlessui/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductQuantityInput from "@/components/ProductQuantityInput";

import {
  getAppConfigs,
  getAppPages,
  getCollectionData,
  getReviews,
  getSeller,
} from "@/db/query";
import {
  ProductType,
  ReviewType,
  UserType,
} from "@/types/db";
import { formatCurrency } from "@/lib/formatters";
import { getProduct } from '@/lib/api'
import { getFinalPrice } from '@/lib/artwork_price'


type ParamsPropsType = {
  slug: string;
};

const AppConfigs = getAppConfigs()
const AppPages = getAppPages()

const ProductPage = ({ params }: { params: ParamsPropsType }) => {
  const { slug: encodedSlug } = params
  const slug = decodeURIComponent(encodedSlug)

  const router = useRouter()
  const { addToCart } = useCart()

  const { title, carousels, sections } = AppPages.product;
  const { slug: productsPageSlug } = AppPages.products;

  const currency = AppConfigs?.currency.code || "USD";
  const priceFloatPoints = AppConfigs?.product_price_float_points ?? 2;

  const [product, setProduct] = useState<ProductType | null>(null);
  const [seller, setSeller] = useState<UserType | null>(null);
  const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [selectedSize, setSelectedSize] = useState<"small" | "medium" | "large">('medium')
  const [quantity, setQuantity] = useState<number>(1);
  const [purchaseNote, setPurchaseNote] = useState<string>("");

  const [price, setPrice] = useState<number>(0);

  const minQuantity = 1;
  const maxQuantity = product?.available;

  useEffect(() => {
    if (slug) {
      const fetchProduct = async () => {
        const fetchedProduct = await getProduct({ slug })

        if (!fetchedProduct) {
          router.push("/")
          return
        }
        setProduct(fetchedProduct)
      }
      fetchProduct()
    }

    const purchaseNote = AppPages.product.purchase_note;
    setPurchaseNote((prev) => purchaseNote || "");
  }, [slug, router]);

  useEffect(() => {
    if (!product?.seller) return
    const fetchedSeller = getSeller({ id: product.seller })
    setSeller((prev) => getSeller({ id: product.seller }));
    if (fetchedSeller) {
      setSeller(fetchedSeller)
    }
  }, [product]);

  // Update price on size change
  useEffect(() => {
    if (!product) return;

    const markup = selectedSize === 'small' ? product.markupSmall
      : selectedSize === 'medium' ? product.markupMedium 
      : selectedSize === 'large' ? product.markupLarge : 0

    const finalPrice = getFinalPrice(selectedSize, markup || 0)
    setPrice(finalPrice)
  }, [selectedSize, product])

  // Add to cart
  const handleAddToCart = () => {
    if (!product) return

    addToCart(
      {
        _id: product.id,
        slug: product.slug,
        title: product.title,
        artist: seller?.name || "",
        imageUrl: product.imageUrl,
        selectedSize, 
        unitPrice: price, // In cents
      },
      quantity
    )
    toast.success("Product added to cart")
    router.push(`/${AppPages.cart.slug || "cart"}`)
  }

  const handleBuyNow = () => {
    if (!product) return

    addToCart(
      {
        _id: product.id,
        slug: product.slug,
        title: product.title,
        artist: seller?.name || "",
        imageUrl: product.imageUrl,
        selectedSize,
        unitPrice: price,
      },
      quantity
    )
    router.push(`/${AppPages.cart.slug || "cart"}`)
  }

  return (
    <>
      <title>{`${title || "Artwork"} - ${product?.title || "Info"}: ${
        AppConfigs.app_name
      }`}</title>
      <section>
        <MaxWidthWrapper className="mx-auto py-8">
          {product && (
              <div className="relative flex flex-col gap-8 md:flex-row">
                {/* Product Media */}
                <div className="area-media max-h-fit w-full md:w-1/2">
                  <div className="sticky left-0 top-0 select-none md:py-4">
                    <InnerImageZoom
                      src={product.imageUrl}
                      width={500}
                      height={500}
                      className="area-image mx-auto max-h-96 rounded-sm object-contain md:max-h-[80vh]"
                    />
                  </div>
                </div>
                {/* Product Info */}
                <div className="w-full md:w-1/2">
                  <div className="space-y-4 md:py-4">
                    <div className="product-info-header space-y-1">
                      <h5 className="seller-name font-tertiary text-sm font-normal capitalize text-muted-foreground md:text-base">
                        {seller?.name}
                      </h5>
                      <h1 className="area-title product-title font-semibold capitalize text-theme-primary">
                        {product.title}
                      </h1>

                      <div className="product-price pt-2 font-primary text-foreground">
                        <span className="price text-xl md:text-3xl">
                          {formatCurrency(price / 100, currency, priceFloatPoints)}
                        </span>
                      </div>
                    </div>
                        {/* Radio buttons for size options */}
                    <div className="product-size-options space-y-3">
                      <RadioGroup className="mb-2 text-base font-bold uppercase">Choose Size</RadioGroup>
                      <RadioGroup value={selectedSize} onChange={setSelectedSize}>
                        <div className="flex flex-wrap gap-2">
                          {["small", "medium", "large"].map((size) => (
                            <Radio
                              key={size}
                              value={size}
                              className="group relative isolate flex cursor-pointer gap-1 rounded-lg border border-theme-primary bg-background p-2 text-theme-primary shadow-md transition focus:outline-none data-[checked]:bg-theme-primary data-[checked]:text-background data-[focus]:outline-1 data-[focus]:outline-theme-primary"
                            >
                              {size.charAt(0).toUpperCase() + size.slice(1)}
                              <CheckCircle className="!text-background !opacity-0 transition group-data-[checked]:!opacity-100" />
                            </Radio>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="product-quantity">
                        <ProductQuantityInput
                          title="Quantity"
                          quantity={quantity}
                          setQuantity={setQuantity}
                          minQuantity={minQuantity}
                          maxQuantity={maxQuantity}
                        />
                    </div>

                    <div className="purchase-note">
                      <p
                        className="text-xs italic leading-loose"
                        dangerouslySetInnerHTML={{
                          __html: purchaseNote,
                        }}
                      ></p>
                    </div>
                    <div className={cn("grid grid-cols-1 items-center gap-2")}>
                        <>
                          <Button
                            variant="outline"
                            className="w-full max-w-md border-theme-primary font-semibold text-theme-primary"
                            onClick={handleAddToCart}
                          >
                            Add to Cart
                          </Button>
                          <Button
                            className="w-full max-w-md font-semibold"
                            onClick={handleBuyNow}
                          >
                            Buy Now
                          </Button>
                        </>
                    </div>
                    <p className="area-text mb-2 text-lg text-gray-600">
                      {product.description}
                    </p>
                  </div>
                </div>
              </div>
          )}
        </MaxWidthWrapper>
      </section>

      {/* Additional Info */}
      <section>
        <MaxWidthWrapper className="py-6 md:py-8">
          <div className="mt-8 capitalize">
            <h4 className="mb-2 uppercase text-theme-primary">
              <span className="underline">Additional Info</span>:-
            </h4>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {product?.additional_info?.map((info, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <span className="mr-2 text-lg font-semibold text-theme-primary">
                    {info.key}:
                  </span>
                  <span className="text-lg text-gray-600">{info.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Recommended Products Carousel */}
      {carousels.map((carousel, index) => {
        const products = getCollectionData({
          id: carousel.collection_id,
        }) as ProductType[];

        return (
          <section key={index} id="products-area">
            <MaxWidthWrapper className="py-8">
              <ProductsCarousel
                title={carousel.title}
                description={carousel?.description}
                products={products}
                baseUrl={`/${productsPageSlug}`}
                showActionBtns={false}
                className="[&_.area-title]:md:text-2xl"
                notFoundMsg={AppConfigs?.messages?.products?.not_found}
              />
            </MaxWidthWrapper>
          </section>
        )
      })}
    </>
  );
};

export default ProductPage;
