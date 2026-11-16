# Overview and scientific detail: two reading levels

The main calendar has two reading levels over the same data. Nothing was removed from
the application; information moved between levels.

- **Overview** opens for a visit with no calendar selection (the bare home page). It
  leads with plain words: where and what, one status line, three controls, the calendar
  with the selected day beside it, and a glossary.
- **Scientific detail** is the layout that existed before. It opens for any link that
  names a series, year, date or comparison, so every link in the presentation guide and
  the acceptance journeys behaves as before. Compared with the previous `main`, its text
  differs only by the level switch.

`obs_detail=overview` or `obs_detail=full` in the address sets the level explicitly. A
selection made in the overview keeps the overview; the switch is always one click away.
The Methodology and Map pages, the synthetic demonstration and the raw-data preview are
unchanged.

## Why two levels

- Reviewers reported that the first screen showed no data, repeated its warnings and used
  project vocabulary ("Plan A", "Harmonized", "S-NPP") before saying what the page is.
- NASA FIRMS met the same problem and split its interface into
  [Basic and Advanced modes](https://www.earthdata.nasa.gov/news/blog/basic-advanced-modes-firms-users).
- Nielsen Norman Group's guidance on
  [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends at most two levels and an obvious, clearly labeled path between them.
- A [review of climate information websites](https://oa.tib.eu/renate/handle/123456789/11339)
  found the recurring barriers to be technical wording, thin guidance and uncertainty
  shown without context.

## Where each piece of evaluator information lives

Each block is marked in the calendar with `data-evidence`. A test fails if a marker or
its registered wording disappears.

| Information | Marker | Scientific detail | Overview |
| --- | --- | --- | --- |
| Real NASA inputs, region reference, missing is not zero | `data-origin` | Top notice | Status line and its details |
| Plan A approval, scope and caveat counts | `approval-summary` | Summary line | Status line details, in plain words with the same counts |
| Approved claim and Terra night alignment | `approval-claim` | Approval details | Approved claim in the status line details |
| What the series measures; no total from gaps | `series-description` | Calendar introduction | Glossary |
| Estimate, no estimate, not acquired, beyond training range | `legend-states` | Legend | Legend lists the states present |
| Fixed logarithmic color scale | `color-scale` | Scale with MW steps | Gradient with its range and step |
| Keyboard use, scale policy, missing years | `calendar-notes` | Calendar footnote | Short note under the legend |
| Whether the day is an estimate, a gap or a native record | `day-status` | Day panel | "Scientific detail for this day" |
| Training, previously examined or independent role | `sample-role` | Day panel | Plain label in the panel; registered label in the day detail |
| S-NPP observation and uncalibrated benchmark | `day-references` | Day panel | Range strip in the panel; registered labels in the day detail |
| Empirical 80% interval and training-range policy | `day-interval` | Day panel | Shaded band and caption; registered wording in the day detail |
| Regional solar-day definition | `solar-day` | Day panel footnote | Day detail |
| Rule versions and manifest | `provenance` | Provenance | Provenance |

## What the overview adds

- A range strip that puts the estimate with its interval, the Suomi-NPP reference and
  the uncalibrated reading on one axis. Every value is also written as text.
- The selected day beside the calendar on wide windows, so a selection changes something
  in view.
- Plain names first, with the technical name beside them, and a six-term glossary.
- A general title with the pilot region named above it, so the tool reads as extensible
  beyond the Pantanal without claiming coverage it does not have.
- A scope sentence: past activity for a whole region; not a forecast, a property map or
  burned area.

It adds no statistic. Every number shown is one the scientific detail already shows.

## Not in this change

Cell-level evidence markers, a plain-language yearly summary sentence (which needs the
scientific owner's wording), data download, a citation block, and the map and record
table. These were raised in review and remain open.

## Follow-up after review

The uncertainty-band caption describes an interval calibrated against the S-NPP
reference, not a guarantee about where a fixed point estimate will fall. Missing
project acquisition and absence of selected positive records have separate plain
explanations. Guided acceptance checks now explicitly select Scientific detail
when they use its technical control names; the unaided task remains in Overview.
The [delivery plan](usability-next-steps.md) tracks the requested features and
external checks without marking them implemented.
