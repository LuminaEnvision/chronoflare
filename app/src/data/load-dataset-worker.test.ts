import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { loadDatasetInWorker } from "./load-dataset-worker";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminated = false;
  requested = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage() { this.requested = true; }
  terminate() { this.terminated = true; }
}

function installWorker(t: TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", {
    value: FakeWorker, configurable: true, writable: true,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "Worker", original);
    else Reflect.deleteProperty(globalThis, "Worker");
  });
}

test("worker result is returned and its resources are released", async (t) => {
  installWorker(t);
  const promise = loadDatasetInWorker(new AbortController().signal);
  const worker = FakeWorker.instances.at(-1)!;
  assert.equal(worker.requested, true);
  const dataset = { marker: "validated in worker" };
  worker.onmessage!({ data: { ok: true, dataset } });
  assert.equal(await promise, dataset);
  assert.equal(worker.terminated, true);
});

test("validation and worker startup errors reject and release the worker", async (t) => {
  installWorker(t);
  const validation = loadDatasetInWorker(new AbortController().signal);
  const first = FakeWorker.instances.at(-1)!;
  first.onmessage!({ data: { ok: false, message: "Dataset versions do not match" } });
  await assert.rejects(validation, /Dataset versions do not match/);
  assert.equal(first.terminated, true);
  const startup = loadDatasetInWorker(new AbortController().signal);
  const second = FakeWorker.instances.at(-1)!;
  second.onerror!();
  await assert.rejects(startup, /worker could not load/);
  assert.equal(second.terminated, true);
});

test("leaving a view cancels its worker; pre-cancelled loads create none", async (t) => {
  installWorker(t);
  const controller = new AbortController();
  const pending = loadDatasetInWorker(controller.signal);
  const worker = FakeWorker.instances.at(-1)!;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(worker.terminated, true);
  const count = FakeWorker.instances.length;
  await assert.rejects(loadDatasetInWorker(controller.signal), { name: "AbortError" });
  assert.equal(FakeWorker.instances.length, count);
});
