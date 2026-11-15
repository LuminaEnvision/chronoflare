# Selection, URL state and browser navigation

The primary real-data calendar, synthetic demo, raw-map review and scientific
charts have separate selection namespaces. The shared hook owns view/Home
navigation; dataset-specific helpers own their qualified parameters. Neither
navigation nor a URL can grant scientific approval.

## Active URL contract

| Context | Parameters | Source of truth |
| --- | --- | --- |
| View | `view=calendar|map|methodology`; default Calendar is omitted | `selection.ts` / `useSelection` |
| Real calendar | `obs_source=harmonized|snpp|terra|aqua`, `obs_year`, `obs_date`, `obs_compare` | `observations.ts`, verified export manifest |
| Real comparison inspector | `obs_compare_day=MM-DD` | `exploration-state.ts` |
| Paired evidence chart | `pair_roles`, `pair_date` | `exploration-state.ts` |
| Synthetic calendar | `calendar_data=demo`, legacy `basis`, `date`, `region`, `compare`, `compare_basis`, `years` | `selection.ts`, legacy `data/v1` schema |
| Saved synthetic choices outside demo | The legacy fields with a `demo_` prefix | [Scoped routing](scoped-calendar-routing.md) |
| Experimental August 2020 preview | `calendar_data=experimental`, `solar_*` | [Preview contract](experimental-solar-calendar.md) |
| Separate raw map | `raw_*`, including `raw_region` and `raw_source` | [Detection explorer](detection-explorer.md) |

Example real comparison:
`?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01&obs_compare=2024&obs_compare_day=08-02`.

Example evidence selection:
`?view=methodology&pair_roles=independent_holdout&pair_date=2020-01-04`.
`pair_roles=none` explicitly preserves no groups selected; omission selects all.
The paired inspector, role filters and comparison month/day survive reload,
copied links and Back/Forward. Filtering preserves the chart domain and does
not recalculate registered metrics. See [inspection behavior](exploration-inspection-and-sharing.md).

## Real-calendar defaults and corrections

With the verified approval present, the default series is harmonized; native
S-NPP, Terra and Aqua remain available. The initial preferred year is 2020 when
available, and the fallback day is August 1. These defaults are not the legacy
fixture adapter's latest-record default.

- Valid requested dates, including gaps, remain selected. No interpolation or
  inferred zero is introduced.
- Unknown series, unavailable years, impossible dates and invalid year comparisons
  produce an explanation and a coherent replacement URL. The app explains that
  2016 was not acquired; it is not a year with no fire.
- Interactive year changes preserve the month/day when it exists and has a value;
  otherwise the nearest date with a value is selected with a visible notice.
  This is an explicit year-switch behavior, not a silent rewrite of a deep-linked gap.
- Previous/next available-value controls stay within the selected year. Native
  recorded values may be partial turns and retain that qualification.
- Explicit calendar selections reveal the daily panel; selecting a comparison
  year reveals the loaded chart. Arrow-key focus movement alone does not scroll
  the page. Reduced motion avoids animated scrolling.
- February 29 uses a shared leap-year month/day axis. A non-leap comparison date
  is explicitly nonexistent, never substituted with March 1.

The region is the fixed official IBGE Pantanal reference; URLs do not dynamically
load arbitrary areas. Ranges and input completeness are not evidence of cloud-free
observation coverage.

## Synthetic context and compatibility

The fixture adapter retains its record/approval gates, basis-specific latest-date
default, date-range validation and comparison rules. These apply only to the
separate synthetic mode. The application passes fixture data into the shared
hook only in that context; cached demo data cannot resolve real-observation inputs.

Old explicit generic fixture choices are preserved under `demo_*` outside demo,
and restored when `calendar_data=demo` is selected. Real navigation does not invent
`basis=viirs` or `region=pantanal-pilot`. Raw-map, observation and evidence state,
unrelated query values, pathname and fragment are preserved. Library helpers
retain their legacy behavior by default; the application opts into scoped routing.

## History, links and verification

Defaults/corrections replace the current entry; deliberate changes push when the
URL changes. `popstate` restores state without additional history entries.
Dataset helpers dispatch the same location notification after intentional updates.
Use their helpers rather than local duplicate state or unrelated ad-hoc URL writes.

Home uses `homeHref` and `activateSelectionLink`: ordinary activation uses app
navigation; modified clicks and new-tab/copy behavior retain a real coherent href.
Unit tests cover scoped/legacy contexts, hydration, correction, chronology,
null/gap semantics and sharing. Browser checks have exercised desktop and mobile
Chromium, including touch emulation. Those checks do not certify physical-device
Safari, assistive technology or every external-provider failure.
