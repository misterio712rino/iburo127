import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { DemoIdentityProvider } from "@/components/platform/DemoIdentityProvider";

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

export const metadata: Metadata = {
  title: "iБюро — Личный кабинет",
  description: "Платформа сопровождения процедуры банкротства",
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
