import ArtistHeader from "@/components/site/ArtistHeader";

export default function Header({ params }: { params: { slug: string } }) {
  return <ArtistHeader handle={params.slug} />;
}
