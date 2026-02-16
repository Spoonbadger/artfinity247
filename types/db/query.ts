import {
  CollectionDataType,
  ReviewDataType,
  CartItemType,
  CartItemProductType,
} from "@/types";
import { Role } from "@prisma/client"

export type CommonSingleItemQuery = {
  id?: string | null;
  slug?: string | null;
};

export type CommonMultiItemQuery = {
  ids?: string[] | null;
  slugs?: string[] | null;
  start?: number;
  limit?: number;
};

export type SingleReviewQuery = CommonSingleItemQuery & {
  item_id?: string | null;
  type?: ReviewDataType | null;
};

export type MultiReviewsQuery = CommonMultiItemQuery & {
  item_ids?: string[] | null;
  types?: ReviewDataType[] | null;
};

export type SingleProductQuery = CommonSingleItemQuery & {
  seller_id?: string | null;
};

export type MultiProductsQuery = CommonMultiItemQuery & {
  seller_ids?: string[] | null;
};

export type SingleUserQuery = CommonSingleItemQuery & {
  roles?: Role[] | null;
};

export type MultiUsersQuery = CommonMultiItemQuery & {
  roles?: Role[] | null;
};

export type SingleCollectionQuery = CommonSingleItemQuery & {
  type?: CollectionDataType | null;
  item_type?: CollectionDataType | null;
};

export type MultiCollectionsQuery = CommonMultiItemQuery & {
  types?: CollectionDataType[] | null;
  item_types?: CollectionDataType[] | null;
};

export type GetCartItemsQuery = {
  user_id: string | null;
  products?: CartItemProductType[] | null;
  start?: number;
  limit?: number;
};

export type CommonCartItemQuery = {
  user_id: string;
  product: CartItemProductType;
  quantity?: number;
  prev_items?: CartItemType[] | null; // For Development Only
};

export type UpdateCartItemQuery = CommonCartItemQuery & {
  operation: "add" | "update" | "remove";
};
