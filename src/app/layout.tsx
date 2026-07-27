import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";

import BrandSeal from "@/components/BrandSeal";
import CosmicBackground from "@/components/CosmicBackground";
import { BRAND } from "@/lib/brand";

import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.appName} · ${BRAND.name}`,
  description: BRAND.tagline,
  authors: [{ name: BRAND.name, url: BRAND.github }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${orbitron.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <CosmicBackground />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
        <BrandSeal />
      </body>
    </html>
  );
}
