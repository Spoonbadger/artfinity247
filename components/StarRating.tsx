"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import RatingStarIcon from "@/components/svgs/StarsRatingIcon";

export type StarRatingType = {
  ratingInPercent?: number;
  iconSize?: number;
  showOutOf?: boolean;
  maxStars?: number;
  userInteraction?: boolean;
  onClick?: (value: number) => void;
  className?: string;
};

const StarRating = ({
  ratingInPercent = 50,
  iconSize = 18,
  showOutOf = false,
  maxStars = 5,
  userInteraction = false,
  onClick = () => {},
  className,
}: StarRatingType): ReactNode => {
  const [activeStar, setActiveStar] = useState<number>(-1);

  const decimal = ratingInPercent / 20;
  const nonFraction = Math.trunc(decimal);
  const fraction = Number((decimal - nonFraction).toFixed(2));
  const fractionPercent = fraction * 100;

  const size = iconSize;

  const RatingHighlighted = (
    <RatingStarIcon type="highlighted" width={size} height={size} />
  );
  const RatingDefault = (
    <RatingStarIcon type="default" width={size} height={size} />
  );

  const handleClick = (index: number) => {
    onClick(index + 1);
    setActiveStar(index);
  };

  const showDefaultStar = (): ReactNode => {
    return RatingDefault;
  };

  let isShow = true;
  const getStar = (index: number): string => {
    if (index <= nonFraction - 1) {
      isShow = true;
      return "100%";
    } else if (fractionPercent > 0 && isShow) {
      isShow = false;
      return `${fractionPercent}%`;
    } else {
      return "0%";
    }
  };

  const isShowOutOfStar = (index: number): boolean => {
    if (showOutOf) {
      return true;
    }

    const isLoopThrough = (fraction === 0 ? nonFraction : nonFraction + 1) - 1;
    return index <= isLoopThrough;
  };

  const withoutUserInteraction = (index: number): ReactNode => {
    return isShowOutOfStar(index) ? (
      <div style={{ position: "relative" }} key={index}>
        <div
          style={{
            width: getStar(index),
          }}
          className="absolute overflow-hidden"
        >
          {RatingHighlighted}
        </div>
        {showDefaultStar()}
      </div>
    ) : null;
  };

  const withUserInteraction = (index: number): ReactNode => {
    return (
      <div className="relative" onClick={() => handleClick(index)} key={index}>
        <div
          style={{
            width: index <= activeStar ? "100%" : "0%",
          }}
          className="absolute overflow-hidden"
        >
          {RatingHighlighted}
        </div>
        {showDefaultStar()}
      </div>
    );
  };

  return (
    <div className={cn("flex gap-x-1", className)}>
      {[...new Array(maxStars)].map((_, index) =>
        userInteraction
          ? withUserInteraction(index)
          : withoutUserInteraction(index),
      )}
    </div>
  );
};

export default StarRating;
