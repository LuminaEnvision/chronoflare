import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createSelectionStore } from "../data/selection";
import type { View } from "../data/selection";
import type { Dataset } from "../data/schema";

export function useSelection(dataset?: Dataset) {
  const [store] = useState(() =>
    createSelectionStore({
      location: () => ({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      }),
      push: (url) => window.history.pushState(null, "", url),
      replace: (url) => window.history.replaceState(null, "", url),
      onPopState(callback) {
        window.addEventListener("popstate", callback);
        return () => window.removeEventListener("popstate", callback);
      },
    }),
  );
  const resolved = useSyncExternalStore(store.subscribe, store.getSnapshot);
  // Resolve loaded-data gates before painting a pending deep link as available.
  useLayoutEffect(() => store.setDataset(dataset), [store, dataset]);
  return {
    ...resolved,
    setPage: (view: View) => store.update({ view }),
    setBasis: (basis: string) => store.update({ basis, compare: "" }),
    setDate: (date: string) => store.update({ date }),
    setCompare: (compare: string) => store.update({ compare }),
  };
}
