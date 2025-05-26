"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { LatLngExpression } from "leaflet";
import { GoogleMapContainer, OpenStreetMapContainer } from "@/components/maps";
import { MaxWidthWrapper } from "@/components/layout";
import { ContactForm } from "@/components/forms";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { MinimalSection } from "@/components/sections";
import { GenericSectonType } from "@/types";
import { getAppConfigs, getAppPages } from "@/db/query";

const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const ContactPage = (): ReactNode => {
  const mapType: "openstreet" | "google" = "openstreet";

  const [title, setTitle] = useState<string>("");
  const [banner, setBanner] = useState<string>("");
  const [formSection, setFormSection] = useState<GenericSectonType | null>(
    null,
  );
  const [mapSection, setMapSection] = useState<GenericSectonType | null>(null);

  useEffect(() => {
    const { title, banner, sections } = AppPages.contact;

    setTitle((prev) => title);
    setBanner((prev) => banner);
    setFormSection((prev) => sections.form);
    setMapSection((prev) => sections.map);
  }, []);

  return (
    <div>
      <title>{`${title || "Contact Us"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MinimalSection bg={banner} className="page-banner">
          <h1 className="mt-5 text-center text-white">{title}</h1>
          <PageBreadcrumb type="page-banner" />
        </MinimalSection>
      </section>
      <section id="map" className="min-h-96 overflow-hidden py-12 md:py-16">
        <MaxWidthWrapper className="text-center md:text-start">
          <div className="grid grid-cols-1 place-content-center gap-6 md:grid-cols-2 md:gap-8">
            <div className="area-left grid grid-cols-1 place-content-center">
              {mapType === "openstreet" ? (
                <OpenStreetMapContainer
                  position={
                    AppConfigs?.business_address_cords as LatLngExpression
                  }
                />
              ) : (
                <GoogleMapContainer
                  position={AppConfigs?.business_address_cords}
                />
              )}
            </div>
            <div className="area-right grid grid-cols-1 place-content-center">
              <h2 className="area-title mb-4 capitalize xl:text-5xl">
                {mapSection?.title || ""}
              </h2>
              <p
                className="area-text"
                dangerouslySetInnerHTML={{ __html: mapSection?.content || "" }}
                suppressHydrationWarning={true}
              ></p>
              <div className="business-info mt-4 space-y-4">
                <h5>Address:</h5>
                <div className="text-start md:ms-8">
                  <p className="contact">
                    <span className="business-email">
                      <Link
                        href={`tel:${AppConfigs?.business_phone || ""}`}
                        className="mb-4 flex gap-2"
                      >
                        <Phone />
                        {AppConfigs?.business_phone || ""}
                      </Link>
                    </span>
                    <span className="business-email">
                      <Link
                        href={`mailto:${AppConfigs?.business_email || ""}`}
                        className="mb-4 flex gap-2"
                      >
                        <Mail />
                        {AppConfigs?.business_email || ""}
                      </Link>
                    </span>
                  </p>
                  <p className="address text-sm leading-loose">
                    <Link href="/contact#map" className="flex gap-2">
                      <MapPin />
                      {AppConfigs?.business_name || ""},{" "}
                      {AppConfigs?.business_address || ""}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>
      <section id="form" className="py-12 md:py-16">
        <MaxWidthWrapper className="text-center md:text-start">
          <div className="grid grid-cols-1 place-content-center gap-6 md:grid-cols-2 md:gap-8">
            <div className="area-left grid grid-cols-1 place-content-center">
              <h2 className="area-title mb-4 capitalize xl:text-5xl">
                {formSection?.title || ""}
              </h2>
              <p
                className="area-text"
                dangerouslySetInnerHTML={{ __html: formSection?.content || "" }}
                suppressHydrationWarning={true}
              ></p>
            </div>
            <div className="area-right grid grid-cols-1 place-content-center">
              <div className="mx-auto w-full md:max-w-screen-sm">
                <ContactForm
                  title={formSection?.subTitle || ""}
                  className="[&_.area-title]:text-lg [&_.area-title]:md:text-2xl"
                />
              </div>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>
    </div>
  );
};

export default ContactPage;
