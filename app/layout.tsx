import { Geist_Mono, Onest } from "next/font/google";
import "./globals.css";

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
    <html lang="ru" className={`${iburoUi.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
