import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AquaFarm | Catfish Farm Operating System",
  description: "AquaFarm helps catfish farms in Nigeria manage feeding, mortality, water quality, harvest, and cycle performance in one clear operating record.",
  manifest: "/manifest.json",
  openGraph: {
    title: "AquaFarm | Catfish Farm Operating System",
    description:
      "Run your fish farm with tighter daily control using one record for feeding, mortality, water quality, harvest, and cycle performance.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AquaFarm | Catfish Farm Operating System",
    description:
      "Built for catfish farms that want tighter daily control and fewer preventable losses.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
