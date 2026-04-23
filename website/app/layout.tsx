import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "E-Drops | Premium Packaged Drinking Water Delivery in Kerala",
  description: "Experience the convenience of high-quality drinking water delivery with E-Drops. Multi-brand jars, subscription plans, and real-time tracking for Kerala.",
  keywords: ["water delivery", "Kerala", "drinking water", "20L jar delivery", "E-Drops", "Bisleri Kerala"],
  openGraph: {
    title: "E-Drops | Premium Water Delivery",
    description: "Multi-brand jar delivery and logistics platform for Kerala.",
    url: "https://edrops.com",
    siteName: "E-Drops",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
