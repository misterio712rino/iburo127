import type { Metadata } from "next";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export const metadata: Metadata = {
  title: {
    default: "iБюро — Практикум по самостоятельному банкротству",
    template: "%s | iБюро",
  },
  description:
    "Практикум iБюро поможет самостоятельно пройти процедуру банкротства физических лиц законно, безопасно и без дорогостоящих юридических услуг.",
  metadataBase: new URL("https://iburo127.online"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "iБюро — Практикум по самостоятельному банкротству",
    description:
      "Научитесь самостоятельно пройти процедуру банкротства с помощью пошагового практикума iБюро.",
    url: "https://iburo127.online",
    type: "website",
  },
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F2] text-[#2B2B2B]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
