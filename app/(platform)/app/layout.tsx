import type { Metadata } from "next";

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
    <div className="min-h-screen bg-white text-[#1F1F1F]">
      <main>{children}</main>
    </div>
  );
}
