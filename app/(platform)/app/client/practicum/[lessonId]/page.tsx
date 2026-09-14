import { notFound } from "next/navigation";
import { LessonView } from "@/components/platform/practicum/LessonView";
import { PRACTICUM_LESSONS, getPracticumLesson } from "@/lib/platform/demo";
export function generateStaticParams() { return PRACTICUM_LESSONS.map((lesson)=>({ lessonId:lesson.id })); }
export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) { const { lessonId }=await params; const lesson=getPracticumLesson(lessonId); if(!lesson) notFound(); return <LessonView lesson={lesson}/>; }
