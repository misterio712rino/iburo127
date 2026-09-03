"use client";

import { useRef, useState } from "react";
import { Camera, Check, Pencil, UserRound, X } from "lucide-react";

type AvatarProps = {
  avatarUrl: string | null;
};

type NameProps = {
  displayName: string;
};

type UploadTicket = {
  objectKey: string;
  uploadUrl: string;
};

export function ProfileAvatarEditor({ avatarUrl }: AvatarProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setStatus("Используйте JPG, PNG или WebP размером до 5 МБ.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const ticketResponse = await fetch("/api/platform/account/avatar/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
      });
      if (!ticketResponse.ok) throw new Error("AVATAR_TICKET_FAILED");
      const ticket = await ticketResponse.json() as UploadTicket;

      const uploadResponse = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("AVATAR_UPLOAD_FAILED");

      const completeResponse = await fetch("/api/platform/account/avatar/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: ticket.objectKey }),
      });
      if (!completeResponse.ok) throw new Error("AVATAR_COMPLETE_FAILED");

      window.location.reload();
    } catch {
      setStatus("Не удалось загрузить фотографию. Попробуйте ещё раз.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="shrink-0">
      <div className="relative">
        <div className="grid size-20 overflow-hidden rounded-[24px] bg-[#f0eeea] text-[#b9202b] shadow-sm lg:size-24">
          {avatarUrl ? (
            // The avatar URL is a short-lived, server-issued private object-storage URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Фотография профиля" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center"><UserRound className="size-9 lg:size-11" aria-hidden="true" /></span>
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
        <label
          htmlFor="profile-avatar-input"
          className="absolute -bottom-2 -right-2 grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border-4 border-white bg-[#17202a] text-white shadow-md transition hover:bg-[#263342]"
          aria-label="Загрузить фотографию профиля"
        >
          <Camera className="size-5" aria-hidden="true" />
        </label>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-busy={pending}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Camera className="size-4" aria-hidden="true" />
        {pending ? "Загрузка…" : avatarUrl ? "Заменить фото" : "Загрузить фото"}
      </button>
      {status ? <p className="mt-2 max-w-48 text-xs font-medium leading-5 text-[#7B2330]" role="alert">{status}</p> : null}
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
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      >
        <Pencil className="size-4" aria-hidden="true" />
        Изменить имя
      </button>
    );
  }

  return (
    <div className="mt-3 min-w-0">
      <label htmlFor="profile-display-name" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Новое имя</label>
      <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="profile-display-name"
          value={value}
          maxLength={80}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-[#7B2330] focus:ring-2 focus:ring-[#7B2330]/15"
        />
        <button
          type="button"
          onClick={() => void saveName()}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(displayName);
            setStatus(null);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <X className="size-4" aria-hidden="true" />
          Отмена
        </button>
      </div>
      {status ? <p className="mt-2 text-sm font-medium text-[#7B2330]" role="alert">{status}</p> : null}
    </div>
  );
}
