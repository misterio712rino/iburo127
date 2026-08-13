"use client";

import { useSyncExternalStore } from "react";
import { getQuestionnaireSeed, QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/demo";
import type { QuestionnaireAnswer, QuestionnaireAnswers } from "@/lib/platform/types";

const STORAGE_PREFIX = "iburo.demo.questionnaire.v1.";
const EVENT_NAME = "iburo-questionnaire-progress";
type StoredState = { started:boolean; answers:QuestionnaireAnswers; completedSectionIds:string[] };
const serverSnapshots = new Map<string,string>();

function initialState(identityId:string):StoredState { const seed=getQuestionnaireSeed(identityId); return { started:seed?.started ?? false, answers:{...(seed?.initialAnswers ?? {})}, completedSectionIds:[...(seed?.initialCompletedSectionIds ?? [])] }; }
function readState(identityId:string):StoredState { try { const stored=window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`); return stored ? JSON.parse(stored) as StoredState : initialState(identityId); } catch { return initialState(identityId); } }
function subscribe(callback:()=>void) { window.addEventListener(EVENT_NAME,callback); window.addEventListener("storage",callback); return ()=>{ window.removeEventListener(EVENT_NAME,callback); window.removeEventListener("storage",callback); }; }
function serverSnapshot(identityId:string) { const existing=serverSnapshots.get(identityId); if(existing) return existing; const value=JSON.stringify(initialState(identityId)); serverSnapshots.set(identityId,value); return value; }
function persist(identityId:string,state:StoredState) { window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`,JSON.stringify(state)); window.dispatchEvent(new Event(EVENT_NAME)); }

export function useQuestionnaireState(identityId:string) {
  const serialized=useSyncExternalStore(subscribe,()=>JSON.stringify(readState(identityId)),()=>serverSnapshot(identityId));
  const state=JSON.parse(serialized) as StoredState;
  const completed=new Set(state.completedSectionIds);
  const completedCount=completed.size;
  const progress=Math.round(completedCount/QUESTIONNAIRE_SECTIONS.length*100);
  const currentSection=QUESTIONNAIRE_SECTIONS.find((section)=>!completed.has(section.id)) ?? QUESTIONNAIRE_SECTIONS.at(-1)!;

  function start() { persist(identityId,{...state,started:true}); }
  function setAnswer(fieldId:string,value:QuestionnaireAnswer) { persist(identityId,{...state,started:true,answers:{...state.answers,[fieldId]:value}}); }
  function validateSection(sectionId:string) { const section=QUESTIONNAIRE_SECTIONS.find((item)=>item.id===sectionId)!; const errors:Record<string,string>={}; for(const field of section.fields) { if(!field.required || !isQuestionnaireFieldVisible(field,state.answers)) continue; const value=state.answers[field.id]; if(value==="" || value===undefined || value===null) errors[field.id]=field.type==="currency" ? `Укажите значение для поля «${field.label}».` : `Заполните поле «${field.label}».`; } return errors; }
  function completeSection(sectionId:string) { const errors=validateSection(sectionId); if(Object.keys(errors).length) return errors; const ids=completed.has(sectionId)?state.completedSectionIds:[...state.completedSectionIds,sectionId]; persist(identityId,{...state,started:true,completedSectionIds:ids}); return errors; }

  return { ...state, completedCount, progress, currentSection, isComplete:completedCount===QUESTIONNAIRE_SECTIONS.length, start, setAnswer, completeSection, validateSection, isCompleted:(id:string)=>completed.has(id) };
}
