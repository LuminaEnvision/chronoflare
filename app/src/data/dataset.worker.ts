import { loadDataset } from "./load";

// Keep JSON decoding and full schema validation off the animation/UI thread.
self.onmessage = async () => {
  try {
    self.postMessage({ ok: true, dataset: await loadDataset() });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load data",
    });
  }
};
