import type { Metadata } from "next";
import { DemoIdentityProvider } from "@/components/platform/DemoIdentityProvider";

export const metadata: Metadata = {
  title: "Platform | iБюро",
  description: "iБюро Platform — Investor Preview Foundation.",
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
      <div className="platform-typography">{children}</div>
    </DemoIdentityProvider>
  );
}
