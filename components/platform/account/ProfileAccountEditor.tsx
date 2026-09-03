"use client";

import { useRef, useState } from "react";
import { Camera, Check, ImagePlus, Pencil, UserRound, X } from "lucide-react";

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
    <div className="w-full shrink-0 sm:w-auto">
      <div className="flex flex-col items-start gap-4 sm:items-center">
        <div className="relative grid size-28 overflow-hidden rounded-full border-[5px] border-white bg-[linear-gradient(145deg,#f4f1ed,#ebe5df)] text-[#b9202b] shadow-[0_14px_32px_rgba(23,32,42,0.14)] lg:size-32">
          {showAvatar ? (
            // The avatar URL is a short-lived, server-issued private object-storage URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl ?? undefined}
              alt="Фотография профиля"
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="grid h-full w-full place-items-center" aria-label="Фотография профиля не установлена">
              <UserRound className="size-12 lg:size-14" aria-hidden="true" />
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
          className="inline-flex min-h-12 min-w-[188px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 lg:text-[15px]"
        >
          {avatarUrl ? <Camera className="size-[18px]" aria-hidden="true" /> : <ImagePlus className="size-[18px]" aria-hidden="true" />}
          {pending ? "Загрузка…" : avatarUrl ? "Заменить фотографию" : "Загрузить фотографию"}
        </button>
      </div>
      {status ? <p className="mt-3 max-w-64 text-sm font-medium leading-5 text-[#7B2330]" role="alert">{status}</p> : null}
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
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#17202a] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(23,32,42,0.16)] transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 lg:text-[15px]"
      >
        <Pencil className="size-[18px]" aria-hidden="true" />
        Редактировать имя
      </button>
    );
  }

  return (
    <div className="mt-5 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <label htmlFor="profile-display-name" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Имя в профиле</label>
      <input
        id="profile-display-name"
        value={value}
        maxLength={80}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        className="mt-2.5 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-[#7B2330] focus:ring-2 focus:ring-[#7B2330]/15"
      />
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void saveName()}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17202a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-[18px]" aria-hidden="true" />
          {pending ? "Сохраняем…" : "Сохранить имя"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(displayName);
            setStatus(null);
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330] focus-visible:ring-offset-2"
        >
          <X className="size-[18px]" aria-hidden="true" />
          Отмена
        </button>
      </div>
      {status ? <p className="mt-3 text-sm font-medium text-[#7B2330]" role="alert">{status}</p> : null}
    </div>
  );
}
