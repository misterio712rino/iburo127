import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { DemoIdentityProvider } from "@/components/platform/DemoIdentityProvider";
import { isDemoPortalEnabled } from "@/server/demo/access";

const iburoSans = Manrope({
  variable: "--font-iburo-sans",
  subsets: ["cyrillic", "latin"],
  weight: "variable",
  style: "normal",
  display: "swap",
});

const iburoDisplay = Cormorant_Garamond({
  variable: "--font-iburo-display",
  subsets: ["cyrillic", "latin"],
  weight: "variable",
  style: "normal",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "iБюро — Демонстрационный кабинет",
  description: "Демонстрационный интерфейс платформы сопровождения процедуры банкротства",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isDemoPortalEnabled()) notFound();

  return (
    <DemoIdentityProvider>
      <div
        className={`${iburoSans.variable} ${iburoDisplay.variable} platform-typography`}
      >
        {children}
      </div>
    </DemoIdentityProvider>
  );
}
