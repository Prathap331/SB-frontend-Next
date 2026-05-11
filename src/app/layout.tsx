import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Providers from "@/components/providers";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Storybit",
  description: "Revolutionary AI-powered scriptwriting platform for content creators worldwide.",
  keywords: "AI scriptwriter, AI script generator, AI story generator, video scriptwriting tool, content creator tools, AI writing assistant, Storybit, YouTube script generator, AI storytelling platform, scriptwriting software, screenplay generator, video content automation, AI video ideas, creative writing AI, story generation AI",
  authors: [{ name: "Morpho Technologies Pvt Ltd" }],
  creator: "Morpho Technologies Pvt Ltd",
  publisher: "Morpho Technologies Pvt Ltd",
  robots: "index, follow",
  openGraph: {
    title: "StoryBit",
    description: "AI-powered storytelling platform",
    url: "https://www.storybit.tech",
    siteName: "StoryBit",
    images: [
      {
        url: "https://www.storybit.tech/Logo.png",
        width: 1200,
        height: 630,
        alt: "StoryBit Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "StoryBit",
    description: "AI-powered storytelling platform",
    images: ["https://www.storybit.tech/og-image.png"],
  },
  // Canonical URL to help search engines and avoid duplicate content
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://storybit.tech',
  },
  icons: {
    icon: "/favicon_io/favicon.ico",
    shortcut: "/favicon_io/favicon.ico",
    apple: "/favicon_io/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        url: "/favicon_io/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        url: "/favicon_io/favicon-32x32.png",
      },
      {
        rel: "android-chrome",
        sizes: "192x192",
        url: "/favicon_io/android-chrome-192x192.png",
      },
      {
        rel: "android-chrome",
        sizes: "512x512",
        url: "/favicon_io/android-chrome-512x512.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={notoSans.variable}>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon_io/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon_io/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon_io/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon_io/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon_io/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon_io/android-chrome-512x512.png" />
      </head>
      <body className={`${notoSans.className} antialiased`}>
        <Providers>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
