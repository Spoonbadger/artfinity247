import { getAppConfigs } from "@/db/query";

const AppConfigs = getAppConfigs();

export const getAverageRating = (ratings: number[]) => {
  if (ratings.length === 0) {
    return 0;
  }
  return parseFloat(
    (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
  );
};

export const getRatingInPercentage = (
  ratings: number[],
  max_rating = AppConfigs.max_product_rating_stars || 5,
) => {
  return getAverageRating(ratings) * (100 / max_rating);
};
