import * as db from ".";
import {
  CartItemType,
  CollectionType,
  ReviewType,
  ProductType,
  SliderType,
  UserType,
} from "@/types";
import {
  CommonMultiItemQuery,
  CommonSingleItemQuery,
  GetCartItemsQuery,
  MultiCollectionsQuery,
  MultiProductsQuery,
  MultiReviewsQuery,
  MultiUsersQuery,
  SingleCollectionQuery,
  SingleProductQuery,
  SingleReviewQuery,
  SingleUserQuery,
  UpdateCartItemQuery,
} from "@/types/db/query";

/* App Info Queries */
export const getAppConfigs = () => {
  return db.AppConfigs;
};

export const getAppPages = () => {
  return db.AppPages;
};

export const getAppMenus = () => {
  return db.AppMenus;
};

export const getDataCards = () => {
  return db.DataCards;
};

export const getCities = () => {
  return db.Cities;
};

export const getStates = () => {
  return db.States;
};

export const getCountries = () => {
  return db.Countries;
};

/* Slider Queries */
export const getSliders = (query: CommonMultiItemQuery = {}): SliderType[] => {
  const { ids, start, limit } = query;

  let result = db.AppSliders as SliderType[];

  if (ids) {
    result = result.filter((slider) =>
      slider._id ? ids?.includes(slider._id) : false,
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const getSlider = (
  query: CommonSingleItemQuery = {},
): SliderType | null => {
  const { id } = query;
  let result = getSliders({ ids: id ? [id] : null });

  return result[0] || null;
};

/* Reviews Queries */
export const getReviews = (query: MultiReviewsQuery = {}): ReviewType[] => {
  const { ids, item_ids, types, start, limit } = query;

  let result = db.Reviews as ReviewType[];

  if (ids) {
    result = result.filter((review) =>
      review._id ? ids?.includes(review._id) : false,
    );
  }

  if (item_ids) {
    result = result.filter((review) =>
      review.item_id ? item_ids?.includes(review.item_id) : false,
    );
  }

  if (types) {
    result = result.filter((review) =>
      review.type ? types?.includes(review.type) : false,
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const getReview = (query: SingleReviewQuery = {}): ReviewType | null => {
  const { id, item_id, type } = query;
  let result = getReviews({
    ids: id ? [id] : null,
    item_ids: item_id ? [item_id] : null,
    types: type ? [type] : null,
  });

  return result[0] || null;
};

/* Product Queries */
export const getProducts = (query: MultiProductsQuery = {}): ProductType[] => {
  const { ids, slugs, seller_ids, start, limit } = query;

  let result = db.Products as unknown as ProductType[]; // dangerous unknown here

  if (ids) {
    result = result.filter((product) => {
      return product._id ? ids?.includes(product._id) : false;
    });
  }

  if (slugs) {
    result = result.filter((product) =>
      product.slug ? slugs?.includes(product.slug) : false,
    );
  }

  if (seller_ids) {
    result = result.filter((product) =>
      product.seller ? seller_ids.includes(product.seller) : false,
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const getProduct = (
  query: SingleProductQuery = {},
): ProductType | null => {
  const { id, slug } = query;

  let result = getProducts({
    ids: id ? [id] : null,
    slugs: slug ? [slug] : null,
  });

  return result[0] || null;
};

/* User Queries */
export const getUsers = (query: MultiUsersQuery = {}): UserType[] => {
  const { ids, slugs, roles, start, limit } = query;

  let result = db.Users as UserType[];

  if (ids) {
    result = result.filter((user) =>
      user._id ? ids?.includes(user._id) : false,
    );
  }

  if (slugs) {
    result = result.filter((user) =>
      user.slug ? slugs?.includes(user.slug) : false,
    );
  }

  if (roles) {
    result = result.filter((user) =>
      user.roles ? roles.every((role) => user.roles?.includes(role)) : false,
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const getUser = (query: SingleUserQuery = {}): UserType | null => {
  const { id, slug, roles } = query;
  let result = getUsers({
    ids: id ? [id] : null,
    slugs: slug ? [slug] : null,
    roles,
  });

  if (slug) {
    result = result.filter((user) => user.slug === slug);
  }

  return result[0] || null;
};

export const getSellers = (query: MultiUsersQuery = {}): UserType[] => {
  const { ids, slugs } = query;

  let result = getUsers({ ids, slugs, roles: ["seller"] });

  return result;
};

export const getSeller = (query: SingleUserQuery = {}): UserType | null => {
  const { id, slug } = query;

  let result = getSellers({
    ids: id ? [id] : null,
    slugs: slug ? [slug] : null,
  });

  return result[0] || null;
};

/* Collection Queries */
export const getCollections = (
  query: MultiCollectionsQuery = {},
): CollectionType[] => {
  const { ids, slugs, types, item_types, start, limit } = query;

  let result = db.Collections as CollectionType[];

  if (ids) {
    result = result.filter((collection) =>
      collection._id ? ids?.includes(collection._id) : false,
    );
  }

  if (slugs) {
    result = result.filter((collection) =>
      collection.slug ? slugs?.includes(collection.slug) : false,
    );
  }

  if (types) {
    result = result.filter((collection) =>
      collection.type ? types?.includes(collection.type) : false,
    );
  }

  if (item_types) {
    result = result.filter((collection) =>
      collection.items_type
        ? item_types?.includes(collection.items_type)
        : false,
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const getCollection = (
  query: SingleCollectionQuery = {},
): CollectionType | null => {
  const { id, slug, item_type, type } = query;

  let result = getCollections({
    ids: id ? [id] : null,
    slugs: slug ? [slug] : null,
    types: type ? [type] : null,
    item_types: item_type ? [item_type] : null,
  });

  return result[0] || null;
};

export const getScenes = (
  query: MultiCollectionsQuery = {},
): CollectionType[] => {
  const { ids, slugs, start, limit } = query;

  const result = getCollections({
    ids,
    slugs,
    types: ["scene"],
    item_types: ["product"],
    start,
    limit,
  });

  return result;
};

export const getScene = (
  query: SingleCollectionQuery = {},
): CollectionType | null => {
  const { id, slug } = query;

  let result = getScenes({
    ids: id ? [id] : null,
    slugs: slug ? [slug] : null,
  });

  return result[0] || null;
};

export const getCollectionData = (
  query: SingleCollectionQuery = {},
): ProductType[] | ReviewType[] | UserType[] | CollectionType[] => {
  const collection = getCollection(query);

  if (!collection) return [];

  const collectionItemsType = collection.items_type;
  const collectionDataIds = collection.items;

  switch (collectionItemsType) {
    case "product":
      return getProducts({ ids: collectionDataIds });
    case "user":
      return getUsers({ ids: collectionDataIds });
    case "seller":
      return getSellers({ ids: collectionDataIds });
    case "scene":
      return getScenes({ ids: collectionDataIds });
    case "collection":
      return getCollections({ ids: collectionDataIds });
    case "review":
      return getReviews({ ids: collectionDataIds });
    default:
      return [];
  }
};

/* Cart Queries */

// Filter out Cart products & variants that don't exist in the database
export const filterCartItems = (
  cartItems: CartItemType[],
  products: ProductType[] = getProducts(),
) => {
  // Create a map of product IDs to their variants
  const productVariantsMap = new Map();
  products.forEach((product) => {
    if (product.variants) {
      const variants = product.variants.flatMap((variant) => {
        if (variant.data) {
          return {
            type: variant.type,
            keys: variant.data.map((data) => data.key),
          };
        }
        return [];
      });
      productVariantsMap.set(product._id, variants);
    }
  });

  // Filter cart items
  const filteredItems = cartItems.filter((cartItem) => {
    const productId = cartItem.product._id;
    const variantKey = cartItem.product.variants?.[0]?.key;
    const variantType = cartItem.product.variants?.[0]?.type;

    // Check if the product exists
    if (productVariantsMap.has(productId)) {
      // If variant_key is provided, check if it exists for the product
      if (variantKey && variantType) {
        return productVariantsMap
          .get(productId)
          .some((variant: { type: string; keys: string[] }) => {
            return (
              variant.keys.includes(variantKey) && variant.type === variantType
            );
          });
      }
      // If no variant, consider the product exists
      return true;
    }

    // Product doesn't exist, remove it from the cart
    return false;
  });

  return filteredItems;
};

export const getCartItems = (
  query: GetCartItemsQuery = {
    user_id: null,
  },
): CartItemType[] => {
  const { user_id = null, products = null, start, limit } = query;

  const user = getUser({ id: user_id });

  if (!user) {
    // throw new Error("User not found or has been removed.");
    return [];
  }

  let result = db.CartItems as CartItemType[];

  result = result.filter((item) => item.quantity > 0); // Only return items with positive quantity
  result = filterCartItems(result); // Only return items which exists in the database

  if (user_id) {
    result = result.filter((item) => user_id === item.user_id);
  }

  if (products) {
    result = result.filter((item) =>
      products.map((item) => item._id).includes(item.product._id),
    );
  }

  return result.slice(start || 0, limit || Infinity);
};

export const updateCartItem = (query: UpdateCartItemQuery) => {
  const {
    user_id = null,
    product = null,
    quantity = 1,
    operation = "add",
    prev_items = null, // For Development Only
  } = query;

  if (!user_id || !product) {
    return [];
  }

  let result = prev_items || getCartItems({ user_id });

  const existingItem = result?.find((item) => {
    const productMatched = product._id === item.product._id;
    const variantMatched = product.variants?.every((variant) =>
      item.product.variants?.some(
        (itemVariant) =>
          itemVariant.type === variant.type && itemVariant.key === variant.key,
      ),
    );

    return item.product.variants?.length
      ? productMatched && variantMatched
      : productMatched;
  });

  switch (operation) {
    case "add":
      if (existingItem) {
        existingItem.quantity += quantity || 1;
        break;
      }

      const newCartItem = {
        _id: Math.random().toString(36).substring(2, 9),
        product,
        user_id,
        quantity,
      };

      if (filterCartItems([newCartItem]).length) {
        result?.push(newCartItem);
        break;
      }

      // throw new Error("Product not found or has been removed.");
      break;

    case "update":
      if (existingItem) {
        existingItem.quantity = quantity >= 0 ? quantity : 1;
      }
      break;

    case "remove":
      if (existingItem) {
        existingItem.quantity = 0;
      }
      break;

    default:
      break;
  }

  result = result.filter((item) => item.quantity > 0); // Only return items with positive quantity

  // db.CartItems = result;
  return result;
};
