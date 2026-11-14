import { test } from "node:test";
import assert from "node:assert/strict";
import { activateSelectionLink, selectionHref } from "./link-navigation";
import { resolveSelection, type Selection } from "./selection";

const selection: Selection = {
  view: "map",
  basis: "modis",
  date: "2024-02-29",
  region: "pantanal-pilot",
  compare: "2023",
};

test("Home links preserve selection, unrelated parameters, path and fragment on a fresh load", () => {
  const href = selectionHref(
    {
      pathname: "/demo",
      search: "?view=map&utm_source=team&tag=a&tag=b",
      hash: "#details",
    },
    selection,
    "calendar",
  );
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, "/demo");
  assert.equal(url.hash, "#details");
  assert.equal(url.searchParams.get("utm_source"), "team");
  assert.deepEqual(url.searchParams.getAll("tag"), ["a", "b"]);
  assert.deepEqual(resolveSelection(url.search).selection, {
    ...selection,
    view: "calendar",
  });
});

function activation(overrides = {}) {
  return {
    button: 0,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    currentTarget: { target: "" },
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...overrides,
  };
}

test("ordinary Home activation navigates without the native page reload", () => {
  const event = activation();
  let calls = 0;
  activateSelectionLink(event, () => calls++);
  assert.equal(event.prevented, true);
  assert.equal(calls, 1);
});

test("modified clicks, other buttons and explicit new-tab links retain native behavior", () => {
  for (const overrides of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
    { defaultPrevented: true },
    { currentTarget: { target: "_blank" } },
    { currentTarget: { target: "named-window" } },
  ]) {
    const event = activation(overrides);
    let calls = 0;
    activateSelectionLink(event, () => calls++);
    assert.equal(event.prevented, false, JSON.stringify(overrides));
    assert.equal(calls, 0, JSON.stringify(overrides));
  }
});

test("explicit same-tab links can still use application navigation", () => {
  const event = activation({ currentTarget: { target: "_self" } });
  let calls = 0;
  activateSelectionLink(event, () => calls++);
  assert.equal(event.prevented, true);
  assert.equal(calls, 1);
});
