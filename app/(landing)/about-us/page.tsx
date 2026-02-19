"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MaxWidthWrapper } from "@/components/layout";
import { ImageWithText, MinimalSection } from "@/components/sections";
import { UserCard } from "@/components/cards";
import AnimatedCounter from "@/components/AnimatedCounter";
import SocialAccountLinks from "@/components/SocialAccountLinks";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { UserType } from "@/types";
import { getAppConfigs, getAppPages, getUsers } from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const AboutPage = (): ReactNode => {
  const { title, content, banner, sections } = AppPages.about_us;
  const { stats, empty_section_imgs, team_members, team_leader } = sections;
  const { slug: sellers_page_slug } = AppPages.sellers;

  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);
    const [liveStats, setLiveStats] = useState({
      artworks: 0,
      artists: 0,
      scenes: 0,
    })

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLiveStats(data);
    };

    fetchStats();
  }, [])

  useEffect(() => {
    setTeamMembers((prev) => getUsers({ ids: team_members.ids }));
  }, [team_members?.ids]);

  return (
    <div>
      <title>{`${title || "About Us"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MinimalSection bg={banner} className="page-banner">
          <h1 className="mt-5 text-center text-white">{title}</h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>
      <section>
        <MaxWidthWrapper className="my-12 md:my-20">
          <p
            className="area-text mb-4 text-justify"
            dangerouslySetInnerHTML={{ __html: content }}
            suppressHydrationWarning={true}
          />
        </MaxWidthWrapper>
      </section>
      <section className="bg-gray-100">
        <MaxWidthWrapper className="py-12 md:py-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 md:grid-cols-3 text-theme-secondary-500">
            {stats?.map((stat, index) => {
              let value = stat?.value ?? 0

              if (stat?.title === "Paintings") value = liveStats.artworks
              if (stat?.title === "Artists") value = liveStats.artists
              if (stat?.title === "Scenes") value = liveStats.scenes

              return (
                <AnimatedCounter
                  key={index}
                  title={stat?.title ?? ""}
                  value={value}
                  suffix={stat?.suffix ?? ""}
                />
              )
            })}
          </div>
        </MaxWidthWrapper>
      </section>
      <section>
        <MinimalSection
          bg={empty_section_imgs[0] || "/assets/images/banner-1.jpg"}
          className="min-h-[30vh] w-full md:min-h-[400px] md:!bg-fixed"
          shadowOpacity="lightest"
        />
      </section>
      {/* team members - not needed and I don't have a team... yet */}
      {/* <section className="bg-gray-100 py-8">
        <MaxWidthWrapper>
          <MinimalSection
            title={team_members?.title}
            content={team_members?.description}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 ">
              {teamMembers.map((member, index) => (
                <Link href={`/${sellers_page_slug}/${member.slug}`} key={index}>
                  <UserCard user={member} className="rounded-sm p-6" />
                </Link>
              ))}
            </div>
          </MinimalSection>
        </MaxWidthWrapper>
      </section> */}
      {/* <section className="whats-on py-10 ">
        <MaxWidthWrapper>
          <MinimalSection
            title={team_leader?.title}
            subTitle={team_leader?.subTitle}
            className={cn("gap-2 text-center", "[&>.area-title]:mb-5")}
          >
            <ImageWithText
              img={team_leader?.img || ""}
              title={team_leader?.name || ""}
              subTitle={team_leader?.position || ""}
              description={team_leader?.description}
              className="[&_.area-content]:md:w-3/4 [&_.area-image]:rounded-full [&_.area-image]:ring [&_.area-image]:ring-theme-primary [&_.area-media]:max-w-48 [&_.area-media]:md:w-1/4 [&_.area-media]:md:max-w-60 [&_.area-text]:line-clamp-none [&_.area-text]:text-justify"
            >
              <SocialAccountLinks
                links={team_leader?.social_accounts}
                className={cn(
                  "justify-center md:justify-start",
                  "[&_*]:!text-gray-400",
                )}
              />
            </ImageWithText>
          </MinimalSection>
        </MaxWidthWrapper>
      </section> */}
    </div>
  );
};

export default AboutPage;
