import type { MetadataRoute } from "next";

/** Web app manifest — home-screen installs get the badge mark (gen:logo output). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mag8",
    short_name: "Mag8",
    description:
      "Four independent research lenses hunt the next generation of mega-cap stocks.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d12",
    theme_color: "#0a0d12",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
