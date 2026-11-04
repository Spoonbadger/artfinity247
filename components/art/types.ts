import type { CartItemProductType } from "@/types";
import type { PrintSize } from "@/components/art/pricing";
import type { Edition } from "@/lib/editionFormat";

export type ScanArt = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  sensitive: string[];
  approved: boolean;
  markupSmall: number;
  markupMedium: number;
  markupLarge: number;
  markupXl: number;
  /** Limited print run status; null/undefined = open edition. */
  edition?: Edition | null;
};

export type ScanArtist = {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  place: string | null;
};

export type MoreArt = { slug: string; title: string; imageUrl: string; sensitive: string[]; fromCents: number };

/** A cart line from a scan. Extra fields ride along in the cart; the API re-prices from the DB. */
export type ScanCartProduct = CartItemProductType & {
  selectedSize: PrintSize;
  listPrice?: number; // cents, before the scan discount
  discountPct?: number; // 5–30, from the printed code
  venue?: string | null; // where it was scanned
};
