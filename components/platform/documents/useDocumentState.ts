"use client";

import { useSyncExternalStore } from "react";
import type { ClientDocumentState } from "@/lib/platform/types";

const STORAGE_PREFIX="iburo.demo.documents.v1.";
const EVENT_NAME="iburo-document-state";
const EMPTY:ClientDocumentState={regeneratedAtById:{},sentForReviewIds:[],reviewedAtById:{}};
const serverSnapshots=new Map<string,string>();
function subscribe(callback:()=>void){window.addEventListener(EVENT_NAME,callback);window.addEventListener("storage",callback);return()=>{window.removeEventListener(EVENT_NAME,callback);window.removeEventListener("storage",callback);};}
function read(identityId:string){try{const value=window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`);if(!value)return EMPTY;const parsed=JSON.parse(value) as Partial<ClientDocumentState>;return{regeneratedAtById:parsed.regeneratedAtById??{},sentForReviewIds:parsed.sentForReviewIds??[],reviewedAtById:parsed.reviewedAtById??{}};}catch{return EMPTY;}}
function serverSnapshot(identityId:string){const existing=serverSnapshots.get(identityId);if(existing)return existing;const value=JSON.stringify(EMPTY);serverSnapshots.set(identityId,value);return value;}
function persist(identityId:string,state:ClientDocumentState){window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`,JSON.stringify(state));window.dispatchEvent(new Event(EVENT_NAME));}
export function useDocumentState(identityId:string){const serialized=useSyncExternalStore(subscribe,()=>JSON.stringify(read(identityId)),()=>serverSnapshot(identityId));const state=JSON.parse(serialized) as ClientDocumentState;return{state,regenerate:(id:string)=>persist(identityId,{...state,regeneratedAtById:{...state.regeneratedAtById,[id]:new Date().toISOString()}}),sendForReview:(id:string)=>persist(identityId,{...state,sentForReviewIds:state.sentForReviewIds.includes(id)?state.sentForReviewIds:[...state.sentForReviewIds,id]}),markReviewed:(id:string)=>persist(identityId,{...state,reviewedAtById:{...state.reviewedAtById,[id]:new Date().toISOString()}})};}
