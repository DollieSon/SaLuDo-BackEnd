// =======================
// PDF TEXT EXTRACTION
// =======================
// Purpose: Extract text from untrusted PDF uploads with a page cap and timeout
//          so a malicious or huge PDF can't hang the API process.
// Related: GeminiResumeService, routes/transcripts.ts
// =======================

import { PDFParse } from "pdf-parse";

const MAX_PDF_PAGES = 50;
const PDF_PARSE_TIMEOUT_MS = 20_000;

export const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let timer: NodeJS.Timeout | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("PDF parsing timed out")),
        PDF_PARSE_TIMEOUT_MS
      );
    });

    const result = await Promise.race([
      parser.getText({ first: MAX_PDF_PAGES }),
      timeout,
    ]);
    return result.text;
  } finally {
    if (timer) clearTimeout(timer);
    await parser.destroy().catch(() => undefined);
  }
};
