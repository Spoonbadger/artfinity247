// Artist pages get the storefront header (artist name in place of the wordmark).
import ArtistHeader from "@/components/site/ArtistHeader";

export default function Header({ params }: { params: { slug: string } }) {
  return <ArtistHeader handle={params.slug} />;
}
