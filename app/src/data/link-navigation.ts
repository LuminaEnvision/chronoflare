import {
  selectionSearch,
  scopedSelectionSearch,
  type Selection,
  type SelectionLocation,
  type View,
} from "./selection";

/** A real link preserves context when copied or opened in another tab. */
export function selectionHref(
  location: SelectionLocation,
  selection: Selection,
  view: View,
  scoped = false,
) {
  return (
    location.pathname +
    (scoped ? scopedSelectionSearch : selectionSearch)(location.search, {
      ...selection,
      view,
    }) +
    location.hash
  );
}

type LinkActivation = {
  button: number;
  defaultPrevented: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  currentTarget: { target: string };
  preventDefault(): void;
};

/** Intercept only ordinary same-tab activation; retain native link shortcuts. */
export function activateSelectionLink(
  event: LinkActivation,
  navigate: () => void,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    (event.currentTarget.target &&
      event.currentTarget.target.toLowerCase() !== "_self")
  )
    return;
  event.preventDefault();
  navigate();
}
