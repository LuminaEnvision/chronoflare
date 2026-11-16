import type { Dataset } from "./schema";

export function loadDatasetInWorker(signal: AbortSignal): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Loading cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(new URL("./dataset.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Loading cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<
      { ok: true; dataset: Dataset } | { ok: false; message: string }
    >) => {
      cleanup();
      if (event.data.ok) resolve(event.data.dataset);
      else reject(new Error(event.data.message));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("Dataset worker could not load. Please try again."));
    };
    worker.postMessage(null);
  });
}
