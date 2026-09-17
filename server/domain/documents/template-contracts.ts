export const DOCUMENT_TEMPLATE_NOT_REGISTERED = "DOCUMENT_TEMPLATE_NOT_REGISTERED";

export type RegisteredDocumentTemplate = {
  documentCode: string;
  version: number;
  sourceSha256: string;
  sourceKind: "DOCX" | "PDF";
};

export interface DocumentTemplateRegistry {
  getActive(documentCode: string): Promise<RegisteredDocumentTemplate | null>;
}

export class EmptyDocumentTemplateRegistry implements DocumentTemplateRegistry {
  async getActive(documentCode: string): Promise<RegisteredDocumentTemplate | null> {
    void documentCode;
    return null;
  }
}
