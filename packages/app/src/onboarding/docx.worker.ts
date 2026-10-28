import mammoth from "mammoth";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: event.data });
    self.postMessage({ text: result.value, warnings: result.messages.length });
  } catch {
    self.postMessage({
      error:
        "This DOCX could not be read. Try an unlocked PDF or another DOCX export.",
    });
  }
};
