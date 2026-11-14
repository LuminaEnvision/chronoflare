import { test } from "node:test";
import assert from "node:assert/strict";
import { scrollLeftToRevealDay } from "./calendar-scroll";

const phone = { clientWidth: 313, scrollWidth: 930, gutter: 45 };

test("a day already beside the year labels does not move the strip", () => {
  assert.equal(
    scrollLeftToRevealDay({
      ...phone,
      scrollLeft: 400,
      dayLeftInView: 100,
      dayWidth: 2,
    }),
    400,
  );
});

test("a day past the right edge is centered in the area beside the years", () => {
  assert.equal(
    scrollLeftToRevealDay({
      ...phone,
      scrollLeft: 0,
      dayLeftInView: 674,
      dayWidth: 2,
    }),
    496,
  );
});

test("a day hidden under the year labels is scrolled clear of that gutter", () => {
  const next = scrollLeftToRevealDay({
    ...phone,
    scrollLeft: 500,
    dayLeftInView: 20,
    dayWidth: 2,
  });
  const dayOffset = 520;
  assert.ok(next + phone.gutter <= dayOffset);
  assert.ok(dayOffset + 2 <= next + phone.clientWidth);
});

test("the strip does not scroll before the first day or past the last day", () => {
  assert.equal(
    scrollLeftToRevealDay({
      ...phone,
      scrollLeft: 0,
      dayLeftInView: 10,
      dayWidth: 2,
    }),
    0,
  );
  assert.equal(
    scrollLeftToRevealDay({
      ...phone,
      scrollLeft: 0,
      dayLeftInView: 900,
      dayWidth: 2,
    }),
    617,
  );
});
