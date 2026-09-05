"use client";

import { useRef, useState } from "react";
import { Camera, Check, Pencil, UserRound, X } from "lucide-react";

type AvatarProps = {
  avatarUrl: string | null;
};

type NameProps = {
  displayName: string;
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
      <div className="flex flex-col items-center gap-3">
        <div className="relative grid size-24 overflow-hidden rounded-full border-4 border-white bg-[#f0eeea] text-[#b9202b] shadow-[0_8px_20px_rgba(23,32,42,0.12)] sm:size-28 lg:size-32">
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

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Camera className="size-4" aria-hidden="true" />
          {pending ? "Загрузка…" : avatarUrl ? "Изменить фото" : "Добавить фото"}
        </button>
      </div>
      {status ? <p className="mt-2 max-w-56 text-center text-xs font-medium leading-5 text-[#7B2330] sm:text-left" role="alert">{status}</p> : null}
    </div>
  );
}

export function ProfileDisplayNameEditor({ displayName }: NameProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function saveName() {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 80) {
      setStatus("Имя должно содержать от 2 до 80 символов.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/platform/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: normalized }),
      });
      if (!response.ok) throw new Error("PROFILE_UPDATE_FAILED");
      window.location.reload();
    } catch {
      setStatus("Не удалось сохранить имя. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setStatus(null);
        }}
        className="mt-3 inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2"
      >
        <Pencil className="size-4" aria-hidden="true" />
        Изменить имя
      </button>
    );
  }

  return (
    <div className="mx-auto mt-3 min-w-0 max-w-xl rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left sm:mx-0">
      <label htmlFor="profile-display-name" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Имя в профиле</label>
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
            setValue(displayName);
            setStatus(null);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2"
        >
          <X className="size-4" aria-hidden="true" />
          Отмена
        </button>
      </div>
      {status ? <p className="mt-2 text-sm font-medium text-[#7B2330]" role="alert">{status}</p> : null}
    </div>
  );
}
