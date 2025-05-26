import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { ProductType, ReviewDataType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLowestPrice } from "@/lib/price_utils";
import StarRating from "@/components/StarRating";
import { getAppConfigs, getReviews, getSeller } from "@/db/query";
import { getRatingInPercentage } from "@/lib/review_utils";

const AppConfigs = getAppConfigs();

const ProductCard = ({
  product,
  showDescription = false,
  showRating = false,
  showSeller = false,
  showAddToCardBtn = false,
  maxRatingStars = 5,
  currency = "$",
  featured = false,
  className,
}: {
  product: ProductType;
  showDescription?: boolean;
  showRating?: boolean;
  showSeller?: boolean;
  showAddToCardBtn?: boolean;
  maxRatingStars?: number;
  currency?: string;
  featured?: boolean;
  className?: string;
}): ReactNode => {
  const MaxRatingStars =
    maxRatingStars || AppConfigs.max_product_rating_stars || 5;

  const { seller: sellerId, title, description, img, variants } = product;
  const seller = getSeller({ id: sellerId });

  const hasVariants = variants && Boolean(variants?.length);
  const lowestProductPrice = hasVariants
    ? getLowestPrice(variants, product.price)
    : product?.price;

  const reviews =
    product._id && getReviews({ item_ids: [product._id], types: ["product"] });
  const ratings = reviews && reviews?.map((review) => review.rating);
  const totalRatings = ratings?.length ?? 0;

  const ratingInPercent = ratings ? getRatingInPercentage(ratings) : 0;

  const isOutOfStock = product.available <= 0;

  return (
    <Card
      className={cn(
        "product-card overflow-hidden border-none text-center shadow-none",
        "[&>*]:px-0 [&_.product-media]:hover:-translate-y-3 [&_.product-media]:hover:scale-105",
        className,
      )}
      title={title}
    >
      <CardHeader className="card-header overflow-hidden rounded-sm px-0">
        <div className="product-media relative h-64 rounded-sm transition-all duration-200 ease-in-out">
          <Image
            src={img}
            height={250}
            width={250}
            alt={title}
            className="product-img h-full w-full rounded-sm object-cover object-top"
          />
          <div className="product-badges">
            {isOutOfStock && (
              <Badge
                variant="destructive"
                className="card-badge absolute bottom-2 right-2 rounded-full"
              >
                Out of Stock
              </Badge>
            )}
            {featured && (
              <Badge
                variant="secondary"
                className="card-badge absolute left-2 top-2 rounded-full bg-slate-900 text-white"
              >
                Featured
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="card-content grid gap-1 p-0">
        <CardTitle className="product-title line-clamp-2 font-bold md:text-xl">
          {title}
        </CardTitle>
        {showSeller && (
          <p className="product-title line-clamp-2 text-xs">
            Author: {seller?.seller_name || "Unknown"}
          </p>
        )}
        {showDescription && (
          <CardDescription className="line-clamp-3 text-muted-foreground">
            {description}
          </CardDescription>
        )}
        {showRating && reviews && (
          <div
            className="product-rating flex items-center justify-center gap-x-1 text-xs"
            title="Product Rating"
          >
            <span className="rating-stars flex gap-x-0.5">
              <StarRating
                ratingInPercent={ratingInPercent}
                iconSize={12}
                showOutOf={true}
                userInteraction={false}
              />
            </span>
            <span className="rating-count">({totalRatings})</span>
          </div>
        )}
        {lowestProductPrice && (
          <div className="product-price line-clamp-2 font-bold uppercase text-slate-800 dark:text-slate-100">
            <span className="price-info">
              <span className="currency">
                {hasVariants && <span>From&ensp;</span>}
                {currency || "$"}
              </span>
              <span className="price">{lowestProductPrice || 0}</span>
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="card-footer bg-transparent px-0 pb-0">
        {showAddToCardBtn && (
          <Button
            className="add-to-cart-btn rounded-full"
            variant="default"
            disabled={isOutOfStock}
          >
            Add to Cart
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
