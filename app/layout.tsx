// app/layout.tsx

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.css";
import "@/styles/typography.css";
import "@/styles/utilities.css";
import "@/styles/animations.css";

import "@/styles/components/buttons.css";
import "@/styles/components/cards.css";
import "@/styles/components/navbar.css";
import "@/styles/components/hero.css";
import "@/styles/components/footer.css";
import "@/styles/components/modals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "AI 3D Portfolio Platform",
    template: "%s | AI 3D Portfolio Platform",
  },

  description: "A fully dynamic, SEO-first, AI-powered personal platform.",
  applicationName: "AI 3D Portfolio Platform",

  openGraph: {
    type: "website",
    siteName: "AI 3D Portfolio Platform",
    url: "/",
    title: "AI 3D Portfolio Platform",
    description: "A fully dynamic, SEO-first, AI-powered personal platform.",
  },

  twitter: {
    card: "summary_large_image",
    title: "AI 3D Portfolio Platform",
    description: "A fully dynamic, SEO-first, AI-powered personal platform.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0f17",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout(props: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
