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

const OG_IMAGE = "https://www.storybit.tech/og-image.jpg";

export const metadata: Metadata = {
  title: "StoryBit",
  description: "AI Powered Fully Automatic Script Writing Platform for Content Creators WorldWide.",
  keywords: "AI scriptwriter, AI script generator, AI story generator, video scriptwriting tool, content creator tools, AI writing assistant, Storybit, YouTube script generator, AI storytelling platform, scriptwriting software, screenplay generator, video content automation, AI video ideas, creative writing AI, story generation AI",
  authors: [{ name: "Morpho Technologies Pvt Ltd" }],
  creator: "Morpho Technologies Pvt Ltd",
  publisher: "Morpho Technologies Pvt Ltd",
  robots: "index, follow",
  openGraph: {
    title: "StoryBit",
    description: "AI Powered Fully Automatic Script Writing Platform for Content Creators WorldWide.",
    url: "https://www.storybit.tech",
    siteName: "StoryBit",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "StoryBit",
        type: "image/jpeg",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StoryBit",
    description: "AI Powered Fully Automatic Script Writing Platform for Content Creators WorldWide.",
    images: [OG_IMAGE],
  },
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
        {/* Favicons */}
        <link rel="icon" type="image/x-icon" href="/favicon_io/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon_io/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon_io/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon_io/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon_io/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon_io/android-chrome-512x512.png" />
        {/* Explicit OG tags — ensures WhatsApp, iMessage, and older crawlers read them */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StoryBit" />
        <meta property="og:url" content="https://www.storybit.tech" />
        <meta property="og:title" content="StoryBit — Write Your YouTube Script in 3 Minutes" />
        <meta property="og:description" content="AI that transforms your ideas into engaging, factual, research-backed YouTube scripts." />
        <meta property="og:image" content="https://www.storybit.tech/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="StoryBit — Write Your YouTube Script in 3 Minutes" />
        <meta name="twitter:description" content="AI that transforms your ideas into engaging, factual, research-backed YouTube scripts." />
        <meta name="twitter:image" content="https://www.storybit.tech/og-image.jpg" />
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
