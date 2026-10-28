import type { CvSource } from "./model.ts";

async function docxText(
  buffer: ArrayBuffer,
): Promise<{ text: string; warnings: number }> {
  const worker = new Worker(new URL("./docx.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            "Reading this DOCX took too long. Try a smaller file or a PDF export.",
          ),
        );
      }, 20_000);
      worker.onmessage = (event: MessageEvent<unknown>) => {
        clearTimeout(timer);
        const result = event.data;
        if (
          result &&
          typeof result === "object" &&
          "text" in result &&
          typeof result.text === "string" &&
          "warnings" in result &&
          typeof result.warnings === "number"
        )
          resolve({ text: result.text, warnings: result.warnings });
        else
          reject(
            new Error(
              "This DOCX could not be read. Try an unlocked PDF or another DOCX export.",
            ),
          );
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error("The document reader could not start. Please try again."),
        );
      };
      worker.postMessage(buffer, [buffer]);
    });
  } finally {
    worker.terminate();
  }
}
export async function extractCv(file: File): Promise<CvSource> {
  const format = file.name.toLowerCase().endsWith(".pdf")
    ? "pdf"
    : file.name.toLowerCase().endsWith(".docx")
      ? "docx"
      : null;
  if (!format) throw new Error("Choose an English PDF or DOCX file.");
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a non-empty file smaller than 10 MB.");
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
  if (
    (format === "pdf" && new TextDecoder().decode(header) !== "%PDF-") ||
    (format === "docx" && (header[0] !== 80 || header[1] !== 75))
  )
    throw new Error(
      "The file contents do not match its extension. Export a fresh PDF or DOCX.",
    );
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const sections: { label: string; text: string }[] = [];
  const warnings: string[] = [];
  if (format === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      disableFontFace: true,
    });
    task.onPassword = () => {
      void task.destroy();
    };
    const timer = setTimeout(() => {
      void task.destroy();
    }, 20_000);
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 40)
        throw new Error(
          "This document exceeds 40 pages. Choose your CV document.",
        );
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("")
          .trim();
        sections.push({ label: `Page ${pageNumber}`, text });
        if (!text)
          warnings.push(
            `Page ${pageNumber} has no readable text. OCR is not available.`,
          );
        page.cleanup();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("40 pages"))
        throw error;
      throw new Error(
        "This PDF could not be read. If it is locked, export an unlocked copy. You can continue without it.",
      );
    } finally {
      clearTimeout(timer);
      await task.destroy();
    }
  } else {
    const result = await docxText(buffer);
    sections.push({
      label: "Document text · page boundaries unavailable",
      text: result.text.trim(),
    });
    if (result.warnings)
      warnings.push(
        "The document reader reported formatting features it could not interpret. Compare this text with your original.",
      );
  }
  const length = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (!length)
    throw new Error(
      "No readable text was found. Scanned documents need OCR, which is not connected. Try a text-based PDF or DOCX, or continue without a CV.",
    );
  if (length > 250_000)
    throw new Error(
      "This document contains too much text. Choose your CV document.",
    );
  return {
    name: file.name,
    size: file.size,
    hash,
    format,
    importedAt: new Date().toISOString(),
    sections,
    warnings,
    reviewedAt: "",
    notes: "",
  };
}
export function downloadOriginal(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
