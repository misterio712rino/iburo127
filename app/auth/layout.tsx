import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { AuthInteractionStyles } from "@/components/platform/auth/AuthInteractionStyles";

const iburoSans = Manrope({
  variable: "--font-iburo-sans",
  subsets: ["cyrillic", "latin"],
  weight: "variable",
  display: "swap",
});

const iburoDisplay = Cormorant_Garamond({
  variable: "--font-iburo-display",
  subsets: ["cyrillic", "latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Вход — iБюро",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      className={`${iburoSans.variable} ${iburoDisplay.variable} auth-interaction-shell min-h-screen bg-[#f5f3ef] font-[var(--font-iburo-sans)] text-[#17202a]`}
    >
      <AuthInteractionStyles />
      {children}
    </main>
  );
}
