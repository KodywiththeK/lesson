import type { Metadata } from "next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";

import { AppProviders } from "./providers";
import { siteDescription, siteName, siteTitle, siteUrl, socialImage } from "./seo";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: siteTitle,
  description: siteDescription,
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName,
    title: siteTitle,
    description: siteDescription,
    url: "/",
    type: "website",
    locale: "ko_KR",
    images: [{ url: socialImage, width: 1672, height: 941, alt: siteTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
