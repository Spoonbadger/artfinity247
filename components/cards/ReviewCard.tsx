import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReviewType } from "@/types";
import StarRating from "@/components/StarRating";
import { getAppConfigs, getAppPages, getProduct, getSeller } from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ReviewCard = ({
  review,
  maxRatingStars = 5,
  txtAlign = "center",
  showLink = true,
  className,
}: {
  review: ReviewType;
  maxRatingStars?: number;
  txtAlign?: "left" | "right" | "center";
  showLink?: boolean;
  className?: string;
}): ReactNode => {
  const MaxRatingStars =
    maxRatingStars || AppConfigs.max_product_rating_stars || 5;

  const { name, rating, comment, img } = review;
  const ratingInPercent = rating * (100 / MaxRatingStars);

  let reviewItemType = review.type;
  let reviewItem, reviewItemTitle, reviewItemLink;

  switch (reviewItemType) {
    case "seller":
      reviewItem = getSeller({ id: review.item_id });
      reviewItemTitle = reviewItem?.name;
      reviewItemLink = `/${AppPages.sellers.slug}/${reviewItem?.slug}`;
      break;

    default:
      reviewItem = getProduct({ id: review.item_id });
      reviewItemTitle = reviewItem?.title;
      reviewItemLink = `/${AppPages.products.slug}/${reviewItem?.slug}`;
      break;
  }

  return (
    <Card
      className={cn(
        "review-card flex gap-2 border-none shadow-none md:gap-4",
        txtAlign === "center"
          ? "flex-col text-center"
          : txtAlign === "right"
            ? "flex-row-reverse text-right"
            : "text-left",
        className,
      )}
    >
      <CardHeader className="card-header h-full flex-[1_1_0%] p-2">
        <div className="reviewer-img mx-auto mb-2">
          <Image
            src={
              img ||
              "/assets/images/icons/users/generic-user-profile-picture.png"
            }
            alt={name}
            width={50}
            height={50}
            className="min-w-10 rounded-full p-0.5 ring-1 ring-theme-primary-50 md:min-w-14"
          />
        </div>
      </CardHeader>
      <CardContent className="card-content flex-[1_1_100%] p-0">
        <CardTitle className="reviewer-name font-bold md:text-xl">
          {name}
        </CardTitle>
        <div className="review-rating mb-2 text-yellow-400">
          <div
            className={cn(
              "flex items-center gap-x-1 text-xs",
              txtAlign === "center"
                ? "justify-center"
                : txtAlign === "right"
                  ? "justify-end"
                  : "justify-start",
            )}
            title="Rating"
          >
            <span className="rating-stars flex gap-x-0.5">
              <StarRating
                ratingInPercent={ratingInPercent}
                iconSize={12}
                showOutOf={true}
                userInteraction={false}
                maxStars={MaxRatingStars}
              />
            </span>
          </div>
        </div>
        <CardDescription className="review-description text-muted-foreground">
          {comment}
        </CardDescription>
        {showLink && (
          <CardFooter className="line-clamp-1 px-0 py-0 pt-1 text-xs font-light text-gray-500 underline md:text-sm">
            <Link href={reviewItemLink}>{reviewItemTitle}</Link>
          </CardFooter>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
