/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async rewrites() {
    return [
      // Artist pages live at theartfinity.com/@handle
      // Link-in-bio page: theartfinity.com/@handle/links
      { source: "/@:handle/links", destination: "/artists/:handle/links" },
      { source: "/@:handle", destination: "/artists/:handle" },
    ];
  },
};

export default nextConfig;
