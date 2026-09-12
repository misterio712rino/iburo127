import { notFound } from "next/navigation";
import { DocumentPreview } from "@/components/platform/documents/DocumentPreview";
import { DOCUMENT_DEFINITIONS, getDocumentDefinition } from "@/lib/platform/demo";

export const dynamicParams=false;
export function generateStaticParams(){return DOCUMENT_DEFINITIONS.map((document)=>({documentId:document.id}));}
export default async function DocumentPage({params}:{params:Promise<{documentId:string}>}){const {documentId}=await params;if(!getDocumentDefinition(documentId))notFound();return <DocumentPreview documentId={documentId}/>;}
