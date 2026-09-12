"use client";

import { useRef, useState } from "react";
import { Camera, Check, Mail, Pencil, Phone, UserRound, X } from "lucide-react";

import { formatProfileDisplayName, formatProfileNameForStorage } from "@/lib/platform/profile-display-name";

type AvatarProps = {
  avatarUrl: string | null;
};

type NameProps = {
  displayName: string;
};

type ContactProps = {
  field: "email" | "phone";
  value: string | null;
};

export function ProfileAvatarEditor({ avatarUrl }: AvatarProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showAvatar = Boolean(avatarUrl) && !imageFailed;

  async function uploadAvatar(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setStatus("Используйте JPG, PNG или WebP размером до 5 МБ.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/platform/account/avatar", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("AVATAR_UPLOAD_FAILED");
      window.location.reload();
    } catch {
      setStatus("Не удалось загрузить фотографию. Попробуйте ещё раз.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-fit shrink-0 rounded-[26px] border border-slate-100 bg-slate-50/65 p-3 sm:mx-0 sm:p-4">
      <div className="group relative grid size-24 overflow-visible rounded-full sm:size-28 lg:size-32">
        <div className="relative grid h-full w-full overflow-hidden rounded-full border-4 border-white bg-[#f0eeea] text-[#b9202b] shadow-[0_8px_20px_rgba(23,32,42,0.12)]">
          {showAvatar ? (
            // The browser reads the avatar only from the authenticated same-origin proxy.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl ?? undefined}
              alt="Фотография профиля"
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="grid h-full w-full place-items-center" aria-label="Фотография профиля не установлена">
              <UserRound className="size-10 lg:size-12" aria-hidden="true" />
            </span>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            aria-busy={pending}
            aria-label={avatarUrl ? "Изменить фотографию профиля" : "Добавить фотографию профиля"}
            className="absolute inset-0 hidden items-center justify-center rounded-full bg-slate-950/52 text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-180 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
          >
            <span className="flex flex-col items-center gap-1.5 text-[11px] font-semibold tracking-[-0.01em]">
              <Camera className="size-5" aria-hidden="true" />
              {pending ? "Загрузка…" : avatarUrl ? "Изменить" : "Добавить"}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-busy={pending}
          aria-label={avatarUrl ? "Изменить фотографию профиля" : "Добавить фотографию профиля"}
          className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full border-2 border-white bg-white text-slate-600 shadow-[0_5px_16px_rgba(23,32,42,0.14)] transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
        >
          <Camera className="size-4" aria-hidden="true" />
        </button>
      </div>

      <input
        ref={inputRef}
        id="profile-avatar-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAvatar(file);
        }}
      />

      {status ? <p className="mt-2 max-w-56 text-center text-xs font-medium leading-5 text-[#7B2330] sm:text-left" role="alert">{status}</p> : null}
    </div>
  );
}

export function ProfileDisplayNameEditor({ displayName }: NameProps) {
  const profileDisplayName = formatProfileDisplayName(displayName);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profileDisplayName);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function saveName() {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 80) {
      setStatus("ФИО должно содержать от 2 до 80 символов.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/platform/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: formatProfileNameForStorage(normalized) }),
      });
      if (!response.ok) throw new Error("PROFILE_UPDATE_FAILED");
      window.location.reload();
    } catch {
      setStatus("Не удалось сохранить ФИО. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex min-w-0 items-start justify-center gap-1.5 sm:justify-start">
        <h2 className="min-w-0 break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-4xl">
          {profileDisplayName}
        </h2>
        <button
          type="button"
          onClick={() => {
            setValue(profileDisplayName);
            setEditing(true);
            setStatus(null);
          }}
          aria-label="Изменить ФИО"
          title="Изменить ФИО"
          className="grid size-11 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/30"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-3 min-w-0 max-w-xl rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left sm:mx-0">
      <label htmlFor="profile-display-name" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Фамилия Имя Отчество</label>
      <input
        id="profile-display-name"
        value={value}
        maxLength={80}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-[#7B2330] focus:ring-2 focus:ring-[#7B2330]/15"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void saveName()}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(profileDisplayName);
            setStatus(null);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/30 focus-visible:ring-offset-2"
        >
          <X className="size-4" aria-hidden="true" />
          Отмена
        </button>
      </div>
      {status ? <p className="mt-2 text-sm font-medium text-[#7B2330]" role="alert">{status}</p> : null}
    </div>
  );
}

export function ProfileContactEditor({ field, value }: ContactProps) {
  const isEmail = field === "email";
  const label = isEmail ? "Email" : "Телефон";
  const Icon = isEmail ? Mail : Phone;
  const currentValue = value?.trim() ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function saveContact() {
    const normalized = draft.trim();
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setStatus("Укажите корректный email.");
      return;
    }
    if (!isEmail && normalized) {
      const compact = normalized.replace(/[\s().-]/g, "");
      if (!/^\+?\d{7,15}$/.test(compact)) {
        setStatus("Укажите корректный номер телефона.");
        return;
      }
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/platform/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: normalized }),
      });
      if (response.status === 409) {
        setStatus("Этот email уже используется в другой учётной записи.");
        return;
      }
      if (!response.ok) throw new Error("PROFILE_CONTACT_UPDATE_FAILED");
      window.location.reload();
    } catch {
      setStatus("Не удалось сохранить контактные данные. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="relative min-w-0 rounded-2xl border border-border bg-muted/60 p-4 pr-16">
        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </dt>
        <dd className="mt-2 break-all text-sm font-semibold text-foreground">{currentValue || "Не указан"}</dd>
        <button
          type="button"
          onClick={() => {
            setDraft(currentValue);
            setEditing(true);
            setStatus(null);
          }}
          aria-label={`Изменить ${label.toLowerCase()}`}
          title={`Изменить ${label.toLowerCase()}`}
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/30"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <label htmlFor={`profile-contact-${field}`} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </label>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <input
          id={`profile-contact-${field}`}
          type={isEmail ? "email" : "tel"}
          inputMode={isEmail ? "email" : "tel"}
          autoComplete={isEmail ? "email" : "tel"}
          value={draft}
          maxLength={isEmail ? 254 : 32}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isEmail ? "name@example.ru" : "+7 999 000-00-00"}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#7B2330] focus:ring-2 focus:ring-[#7B2330]/15"
        />
        <button
          type="button"
          onClick={() => void saveContact()}
          disabled={pending}
          aria-busy={pending}
          aria-label={`Сохранить ${label.toLowerCase()}`}
          title="Сохранить"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#17202a] text-white transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(currentValue);
            setStatus(null);
          }}
          aria-label={`Отменить изменение ${label.toLowerCase()}`}
          title="Отмена"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/65 text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/25"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {isEmail ? <p className="mt-2 text-[11px] leading-4 text-slate-500">Контактный email для связи и уведомлений. Адрес входа не изменяется.</p> : null}
      {status ? <p className="mt-2 text-xs font-medium leading-5 text-[#7B2330]" role="alert">{status}</p> : null}
    </div>
  );
}
