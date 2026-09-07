"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlatformCard, ProfileAvatar } from "@/components/platform/PlatformPrimitives";

export function LawyerCard({ description }: { description: string }) {
  const [requested, setRequested] = useState(false);
  return (
    <PlatformCard className="flex h-full flex-col p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ваш специалист</p>
      <div className="mt-7 flex items-center gap-4">
        <ProfileAvatar initials="АО" className="size-14" />
        <div><h2 className="text-xl font-semibold tracking-[-0.03em]">Анна Орлова</h2><p className="mt-1 text-sm text-muted-foreground">Юрист iБюро</p></div>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-center gap-2 text-xs font-medium"><span className="size-2 rounded-full bg-primary" />Сопровождает ваше дело</div>
      <div className="mt-auto pt-6">
        <Button variant="outline" size="lg" className="h-11 w-full rounded-full" onClick={() => setRequested(true)}>
          {requested ? <CheckCircle2 data-icon="inline-start" /> : <MessageCircle data-icon="inline-start" />}
          {requested ? "Запрос сохранён" : "Задать вопрос"}
        </Button>
      </div>
      {requested ? <p className="mt-3 text-xs text-muted-foreground" role="status">Вопрос подготовлен для специалиста.</p> : null}
    </PlatformCard>
  );
}
