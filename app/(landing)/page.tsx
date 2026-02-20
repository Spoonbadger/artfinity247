"use client"

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CardGridSection,
  ImageWithText,
  MinimalSection,
} from "@/components/sections";
import { MultiColumnCard, UserCard } from "@/components/cards";
import { HeroSlider } from "@/components/sliders";
import {
  ProductsCarousel,
  CollectionsCarousel,
  ReviewCarousel,
  UsersCarousel,
} from "@/components/carousels";
import ImageGallery from "@/components/sections/ImageGallery";
import { MaxWidthWrapper } from "@/components/layout";
import BackgroundShadow from "@/components/BackgroundShadow";
import {
  CollectionType,
  OurGuaranteeCardType,
  ReviewType,
  ProductType,
  UserType,
  SliderType,
} from "@/types";
import {
  getAppConfigs,
  getAppPages,
  getCollectionData,
  getDataCards,
  getSlider,
} from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const Home = (): ReactNode => {
  const { slug: productsPageSlug } = AppPages.products;
  const { slug: sellersPageSlug } = AppPages.sellers;
  const { slug: scenesPageSlug } = AppPages.scenes;

  const { hero: heroSliderId } = AppPages.home.slider;
  const {
    welcome: welcomeSection,
    discover: discoverSection,
    gallery: gallerySecion,
    our_guarantee: ourGuaranteeSection,
    featured_products: featuredProductsSection,
  } = AppPages.home.sections;
  const {
    products: productsCarousel,
    sellers: sellersCarousel,
    scenes: scenesCarousel,
    reviews: reviewsCarousel,
  } = AppPages.home.carousels;

  // const [ourGuaranteeCards, setOurGuaranteeCards] = useState<
  //   OurGuaranteeCardType[]
  // >([])
  const [featuredProducts, setFeaturedProducts] = useState<ProductType[]>([]);
  const [heroSlider, setHeroSlider] = useState<SliderType | null>(null);

  const [products, setProducts] = useState<ProductType[]>([]);
  const [artists, setArtists] = useState<UserType[]>([]);
  const [scenes, setScenes] = useState<CollectionType[]>([]);
  // const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [sort, setSort] = useState("random") // Might want to actually feature art in future


  useEffect(() => {
    // setOurGuaranteeCards(getDataCards().our_guarantee);
    setHeroSlider(getSlider({ id: heroSliderId }));

    setArtists(
      getCollectionData({
        id: sellersCarousel.collection_id,
      }) as UserType[],
    )

    // setReviews(
    //   getCollectionData({
    //     id: reviewsCarousel.collection_id,
    //   }) as ReviewType[],
    // );

  }, [
    heroSliderId,
    productsCarousel?.collection_id,
    sellersCarousel?.collection_id,
    scenesCarousel?.collection_id,
    reviewsCarousel?.collection_id,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/artworks?limit=12&sort=${sort}`)
        if (!res.ok) throw new Error("Failed to fetch artworks")
        const data = await res.json()
        setProducts(data.artworks || [])
      } catch (err) {
        console.error("Error fetching artworks:", err)
      }
    })()
  }, [sort])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/artists?limit=8&sort=random") // Make random?
        if (!res.ok) throw new Error("Failed to fetch artists")
        const data = await res.json()
        setArtists(data.artists || [])
      } catch (err) {
        console.error("Error fetching artists:", err)
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scenes?limit=10")
        if (!res.ok) throw new Error("Failed to fetch scenes")
        const data = await res.json()
        setScenes(data.scenes || [])
      } catch (err) {
        console.error("Error fetching scenes:", err)
      }
    })()
  }, [])


  return (
    <div className="pb-16">
      <title>{`${AppConfigs.app_name}${AppConfigs.app_tagline ? `: ${AppConfigs.app_tagline}` : ""}`}</title>
      <section id="top-area">
        <HeroSlider slider={heroSlider} />
      </section>
      <section id="welcome-area" className="bg-theme-primary-50">
        <MaxWidthWrapper>
          <MinimalSection
            title={welcomeSection.title}
            subTitle={welcomeSection.subTitle}
            content={welcomeSection.content}
            actionBtns={[
              {
                title: `${welcomeSection.actionBtn.title || "View All"}`,
                href: `${welcomeSection.actionBtn.href || "/products"}`,
                variant: "link",
                icon: "arrowRight",
              },
            ]}
            className="py-10 md:py-16 lg:py-20"
          ></MinimalSection>
        </MaxWidthWrapper>
      </section>
      <section id="discove-area">
        <MaxWidthWrapper className="py-12 sm:px-10 md:px-16">
          <div
            className={cn(
              "grid gap-8 md:grid-cols-2 md:gap-12",
              "[&>*]:p-16 [&>*]:md:p-20",
            )}
          >
            <MinimalSection
              title={discoverSection[0].title}
              actionBtns={[
                {
                  title: discoverSection[0].actionBtn.title,
                  href: discoverSection[0].actionBtn.href,
                  variant: "outline",
                },
              ]}
              bg={discoverSection[0].bg}
              className="[&_.area-title]:text-white [&_.area-title]:lg:text-5xl"
            ></MinimalSection>
            <MinimalSection
              title={discoverSection[1].title}
              actionBtns={[
                {
                  title: discoverSection[1].actionBtn.title,
                  href: discoverSection[1].actionBtn.href,
                  variant: "outline",
                },
              ]}
              bg={discoverSection[1].bg}
              className="[&_.area-title]:text-white [&_.area-title]:lg:text-5xl"
            ></MinimalSection>
          </div>
        </MaxWidthWrapper>
      </section>
      <section id="products-area">
        <MaxWidthWrapper className="py-8">
          <ProductsCarousel
            title={productsCarousel.title}
            subTitle={productsCarousel?.subTitle}
            description={productsCarousel?.description}
            products={products}
            baseUrl={`/${productsPageSlug}`}
            notFoundMsg={AppConfigs?.messages?.products?.not_found}
          />
        </MaxWidthWrapper>
      </section>
      <section id="artists-area">
        <MaxWidthWrapper className="py-8">
          <UsersCarousel
            title={sellersCarousel.title}
            subTitle={sellersCarousel.subTitle}
            description={sellersCarousel.description}
            users={artists}
            baseUrl={`/${sellersPageSlug}`}
            notFoundMsg={AppConfigs?.messages?.sellers?.not_found || "No Artists Found"}
          />
        </MaxWidthWrapper>
      </section>
      <section id="scenes-area">
        <MaxWidthWrapper className="py-8">
          <CollectionsCarousel
            title={scenesCarousel.title}
            description={scenesCarousel.description}
            collections={scenes}
            baseUrl={`/${scenesPageSlug}`}
            className="py-5"
            notFoundMsg={AppConfigs?.messages?.scenes?.not_found}
          />
        </MaxWidthWrapper>
      </section>
      <section id="featured-products-area">
        <MaxWidthWrapper className="py-12 md:px-16">
          {featuredProducts.map((product, index) => (
            <ImageWithText
              key={index}
              img={product.imageUrl}
              title={product.title}
              description={product.description}
              imgAlign={index % 2 === 0 ? "left" : "right"}
              txtAlign={index % 2 === 0 ? "right" : "left"}
              textAsPopup={true}
              imgLoading="eager"
              actionBtns={[
                {
                  title: `${featuredProductsSection.actionBtn.title || "check now"}`,
                  href: `/${productsPageSlug}/${product.slug}`,
                  className: "rounded-sm",
                },
              ]}
            />
          ))}
        </MaxWidthWrapper>
      </section>
      {/* <section id="gallery-area" className="relative isolate">
        <MaxWidthWrapper>
          <ImageGallery
            imgs={products.map((art) => art.imageUrl)}
            title={gallerySecion.title}
            content={gallerySecion.content}
            shuffleImgs={true}
            animate={true}
            asBackground={true}
            className={cn(
              "px-0 py-36 sm:px-8 sm:py-44 md:px-20 md:py-64",
              "[&_.area-title]:text-white [&_.img-galley]:grayscale",
            )}
          />
        </MaxWidthWrapper>
        <BackgroundShadow />
      </section> */}
      {/* <section id="review-area">
        <MaxWidthWrapper className="py-20">
          <ReviewCarousel
            subTitle={reviewsCarousel.subTitle}
            title={reviewsCarousel.title}
            description={reviewsCarousel.description}
            reviews={reviews}
            showLink={false}
            notFoundMsg={AppConfigs?.messages?.reviews?.not_found}
          />
        </MaxWidthWrapper>
      </section> */}
      {/* <section id="our-guarantee-area">
        <MaxWidthWrapper>
          <h2 className="area-title mb-4 text-center">
            {ourGuaranteeSection.title || "Our Guarantee"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ourGuaranteeCards &&
              ourGuaranteeCards.map((card, index) => (
                <MultiColumnCard
                  key={index}
                  title={card.title}
                  description={card.description}
                  img={card.img}
                  className="py-5"
                />
              ))}
          </div>
        </MaxWidthWrapper>
      </section> */}
    </div>
  );
};

export default Home;
