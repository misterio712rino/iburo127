import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./client-dashboard.css";
import { resolveProductionStaffMfaState } from "@/server/auth/production-session-provider";

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
  title: "Кабинет — iБюро",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mfaState = await resolveProductionStaffMfaState();
  if (mfaState.status === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (mfaState.status === "REQUIRED") redirect("/auth/mfa-enroll");

  return (
    <main className={`${iburoSans.variable} ${iburoDisplay.variable} min-h-screen bg-[#f5f3ef] font-[var(--font-iburo-sans)] text-[#17202a]`}>
      {children}
    </main>
  );
}
