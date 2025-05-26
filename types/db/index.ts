import { ActionButtonType } from "@/types";

export type CartItemType = {
  _id: string;
  user_id: string;
  product: CartItemProductType;
  quantity: number;
};

export type CityType = {
  _id?: string;
  name: string;
  code: string;
  state_code: string;
  country_code: string;
};

export type CountryType = {
  _id?: string;
  name: string;
  code: string;
  currency: CurrencyType;
  phone_code?: string;
};

export type CurrencyType = {
  _id?: string;
  name: string;
  code: string;
  symbol: string;
};

export type CollectionType = {
  _id: string;
  title: string;
  img: string;
  description?: string;
  items: string[];
  items_type?: CollectionDataType;
  tags?: CollectionTagType[];
  category?: CollectionCategoryType[];
  type: CollectionDataType;
  is_active: boolean;
  slug: string;
};

export type ProductType = {
  _id: string;
  title: string;
  description?: string;
  price?: number;
  img: string;
  tags?: ProductTagType[];
  category?: ProductCategoryType[];
  additional_info?: ProductAdditionalInfo[];
  variants?: ProductVariantType[];
  sku_number?: string;
  available: number;
  rating?: { stars: number; max_stars?: number; count: number };
  is_active: boolean;
  seller?: string;
  slug: string;
};

export type OrderType = {
  _id: string;
  user_id: string;
  products: CartItemProductType[];
  product_price: number;
  total_tax: number;
  total_price: number;
};

export type ReviewType = {
  _id: string;
  name: string;
  rating: number;
  comment?: string;
  item_id: string;
  type: ReviewDataType;
  img: string;
  created_at?: string;
};

export type SessionType = {
  _id?: string;
  user: UserType;
  expires_on: Date;
  is_active: boolean;
};

export type SliderType = {
  _id?: string;
  title?: string;
  description?: string;
  slides: SliderSlideType[];
};

export type SliderSlideType = {
  title?: string;
  subTitle?: string;
  actionBtns?: ActionButtonType[];
  className?: string;
  bg?: string;
};

export type SocialAccountType = {
  _id?: string;
  platform: string;
  url: string;
};

export type StateType = {
  _id?: string;
  name: string;
  code: string;
  country_code: string;
};

export type UserType = {
  _id: string;
  username?: string;
  email: string;
  hash?: string;
  first_name?: string;
  last_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  gender?: string;
  profile_picture: string;
  seller_name?: string;
  bio: string;
  social_accounts?: { platform: string; url: string }[];
  zip_code?: number;
  roles?: UserRoleType[];
  is_active: boolean;
  slug: string;
};

export type UserProductsType = {
  _id: string;
  user_id: string;
  products: CartItemProductType[];
};

export type UserLikesType = {
  _id: string;
  user_id: string;
  products: CartItemProductType[];
  like_date: Date;
};

export type UserPurchaseHistoryType = {
  _id: string;
  user_id: string;
  order_id: string;
  purchase_date: Date;
  products: number;
  product_price: number;
  total_tax: number;
  total_price: number;
};

export type CartItemProductType = {
  _id: string;
  variants?: CartItemProductVariantType[];
};

export type CartItemProductVariantType = { type: string; key: string };

export type ProductAdditionalInfo = CommonKeyDataType & {};

export type ProductVariantType = {
  title: string;
  type: string;
  data: ProductVariantDataType[];
};

export type ProductSelectedVariantType = {
  title?: string;
  type: string;
  key: string;
  value?: string;
  price?: number;
  sku_number?: string;
};

export type ProductVariantDataType = CommonKeyDataType & {
  price: number;
  sku_number?: string;
};

export type ReviewDataType = "product" | "seller";

export type UserRoleType = "subscriber" | "seller" | "editor" | "admin";

export type CommonAreaLocationType = CommonTaggingType & {
  img?: string;
};

export type CommonKeyDataType = { key: string; value: string };

export type CommonTaggingType = {
  _id?: string;
  title: string;
  description?: string;
  slug: string;
};

export type CollectionCategoryType = CommonTaggingType & {};

export type CollectionTagType = CommonTaggingType & {};

export type ProductCategoryType = CommonTaggingType & {};

export type ProductTagType = CommonTaggingType & {};

export type CollectionDataType =
  | "user"
  | "seller"
  | "product"
  | "scene"
  | "review"
  | "collection";
