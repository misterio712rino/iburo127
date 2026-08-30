"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export default function ContactRequestForm() {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    if (!phone && !email) {
      setSubmissionState("error");
      setErrorMessage("Укажите телефон или email, чтобы мы могли связаться с вами.");
      return;
    }

    setSubmissionState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          phone,
          email,
          message: String(data.get("message") ?? ""),
          website: String(data.get("website") ?? ""),
          consent: data.get("consent") === "on",
        }),
      });

      if (!response.ok) {
        setSubmissionState("error");
        setErrorMessage(
          response.status === 400
            ? "Проверьте заполненные данные и попробуйте ещё раз."
            : "Сейчас не удалось отправить сообщение. Позвоните нам или попробуйте немного позже.",
        );
        return;
      }

      form.reset();
      setSubmissionState("success");
    } catch {
      setSubmissionState("error");
      setErrorMessage(
        "Сейчас не удалось отправить сообщение. Позвоните нам или попробуйте немного позже.",
      );
    }
  }

  return (
    <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        required
        maxLength={120}
        autoComplete="name"
        placeholder="Ваше имя"
        className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
      />

      <input
        type="tel"
        name="phone"
        maxLength={32}
        autoComplete="tel"
        placeholder="Телефон"
        className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
      />

      <input
        type="email"
        name="email"
        maxLength={254}
        autoComplete="email"
        placeholder="Email"
        className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
      />

      <textarea
        rows={6}
        name="message"
        maxLength={4000}
        placeholder="Ваш вопрос..."
        className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
      />

      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Не заполняйте это поле</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-[#666]">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-[#7B2330]"
        />
        <span>
          Я соглашаюсь на обработку персональных данных в соответствии с{" "}
          <Link href="/privacy" className="font-medium text-[#7B2330] underline underline-offset-2">
            политикой конфиденциальности
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={submissionState === "submitting"}
        className="w-full rounded-full bg-[#7B2330] py-4 text-lg font-semibold text-white transition hover:bg-[#641B25] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submissionState === "submitting" ? "Отправляем..." : "Отправить сообщение"}
      </button>

      <div aria-live="polite" className="min-h-6 text-sm">
        {submissionState === "success" ? (
          <p className="font-medium text-emerald-700">
            Сообщение отправлено. Мы свяжемся с вами в ближайшее время.
          </p>
        ) : null}
        {submissionState === "error" ? (
          <p className="font-medium text-[#7B2330]">{errorMessage}</p>
        ) : null}
      </div>
    </form>
  );
}
