import type { Metadata } from "next";
import { Geist, Geist_Mono, Onest } from "next/font/google";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const iburoUi = Onest({
  variable: "--font-iburo-ui",
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
      className={`${geistSans.variable} ${iburoUi.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
