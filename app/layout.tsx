import type { Metadata } from "next";
import { Geist_Mono, Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "iБюро",
  title: "iБюро — личный кабинет",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "iБюро",
    statusBarStyle: "default",
  },
};

const iburoSans = Manrope({
  variable: "--font-iburo-sans",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

const iburoDisplay = Source_Serif_4({
  variable: "--font-iburo-display",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${iburoSans.variable} ${iburoDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
