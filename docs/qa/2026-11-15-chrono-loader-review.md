# ChronoLoader sandbox review — November 15, 2026

PR #39 was merged into upstream main at `20da8aa2a48c71eea50770c9f4e9b23cd4709b35`
after the project owner requested review and integration before the scientific
pipeline PRs. The source fork was cloned separately and its production build was
served locally. No source or data changes from the scientific branches were
required for the UI merge.

## Reproduced defect and correction

The original loader can receive a first requestAnimationFrame timestamp earlier
than the performance.now() recorded by its effect setup. A negative delta makes
the satellite pulse radius negative; Canvas throws `IndexSizeError` and the draw
loop never schedules its next frame. This is an animation defect independent of
whether a user's computer is fast. The progress clock could also start negative.

Commit `f1cd89cb98ee6a095f70db13bdfc0fe931d1c2f1`, pushed to Lumina's existing
`feat/chrono-loader` branch with maintainer edits enabled, clamps both elapsed
times to zero. The visual design and normal animation speed are unchanged.
A browser reproduction that offsets RAF timestamps by −40 ms confirmed that
frames continue and no canvas exception occurs after the fix.

## Browser evidence

Chromium on Linux, production build; these are simulated viewport/CPU checks,
not physical iPhone or Safari certification. Canvas timing was sampled over two
seconds while requests were deliberately delayed, so it isolates the loader
rather than measuring overall application load time.

| Case | Result |
| --- | --- |
| Desktop 1365×900 | 121 canvas frames, median 16.7 ms, p95 18.2 ms; no runtime errors |
| Desktop with 6× CPU slowdown | 47 frames, median 40.6 ms, p95 55.7 ms; animation continues without errors |
| 390×844, 4× CPU slowdown, reduced motion | Static globe as intended; no runtime errors or horizontal page overflow |
| Cold calendar, normal CPU | Loader removed on readiness; synthetic-data notice visible |
| Map on desktop and mobile viewport | Panel loader removed, 105 selected Terra records loaded, first record opens with 35.2 MW |
| Background reload | Does not remount the globe; status remains above the map |
| Calendar return and Back | Synthetic notice restored; Terra map filters preserved |

The source points, boundary and accessible table worked with external basemap
requests deliberately blocked; the UI correctly reported incomplete basemap
without hiding detections. This verifies failure behavior, not provider uptime.

The percentage is an elapsed-time easing animation, not measured byte progress.
It does not impose a five-second minimum; actual readiness removes the loader.
Under a heavily slowed CPU its frame rate is lower, even after the crash fix.

## Checks

Production build, 102 application tests, data validation (10,228 fixture records),
English-language and whitespace checks passed. Current-head CI passed in run
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43716055474 .
Git reported no merge conflicts. The upstream merge does not by itself certify
that Lumina's default branch or the production Vercel deployment has synced.
