declare module 'pdf-parse' {
  interface PDFMetadata {
    fileName?: string;
  }

  interface PDFPage {
    text: string;
  }

  export interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: PDFMetadata;
    version: string;
    text: string;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFParseResult>;

  export default pdf;
}
