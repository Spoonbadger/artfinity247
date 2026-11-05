/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // TDMRep (W3C): reserve text-and-data-mining rights on every page and image.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "tdm-reservation", value: "1" }] }];
  },
  async rewrites() {
    return [
      // Artist pages live at theartfinity.com/@handle
      // Painting (buy page): theartfinity.com/@handle/art/<slug>. Old /art/<slug> links 308 here.
      { source: "/@:handle/art/:art", destination: "/artists/:handle/art/:art" },
      // Link-in-bio page: theartfinity.com/@handle/links
      { source: "/@:handle/links", destination: "/artists/:handle/links" },
      { source: "/@:handle/collections", destination: "/artists/:handle/collections" },
      { source: "/@:handle/collections/:collection", destination: "/artists/:handle/collections/:collection" },
      { source: "/@:handle", destination: "/artists/:handle" },
    ];
  },
};

export default nextConfig;
