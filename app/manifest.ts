import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AquaFarm",
    short_name: "AquaFarm",
    description: "Catfish farm management app",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
  };
}
