import type { Metadata } from "next";
import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "Часто задаваемые вопросы",
  description:
    "Ответы на самые популярные вопросы о банкротстве физических лиц.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQPage() {
  return <FAQClient />;
}
