# ChronoFlare — user journeys and acceptance tests

For Anastasia and André. Prepared on 2026-11-15 against main through PR #58. Numeric references were checked against the actual published assets. These personas describe proposed users, not completed user research.

Website: https://chronoflare.vercel.app/
Portuguese handoff: [André's version](handoff/andre-anastasia-user-journeys.md).

## Test approach

Read the user need first and try to complete it without the instructions. Record hesitation, then follow the steps to check functionality. This separates discoverability problems from implementation failures.

Use PASS, FAIL, UNCLEAR, ENVIRONMENT BLOCKED or NOT TESTED. Record device, browser/version, approximate viewport, timestamp and exact URL. Capture screenshots without private information and record whether the deployed fork matches the expected main version. An external image failure is not proof of a scientific-data failure; check the message and whether records remain accessible.

Suggested split: André checks interpretation in UC1, UC3 and UC4; Anastasia checks interaction in UC2, UC5 and UC6. Both run UC1. Allow 25–40 minutes per person. Prioritize UC1, UC2, UC3 and mobile UC6 when time is limited.

## UC1 — researcher inspects one day

Task: You are preparing a research summary of fire activity in the Pantanal on
**1 August 2020**. Starting on the homepage, use the project's real data to find:

- The harmonized FRP estimate, in MW.
- The S-NPP observed value, in MW, and whether the estimate is higher or lower.
- The lower and upper bounds of the displayed uncertainty interval.

Do not consult the steps or expected answers on the first attempt. This asks for
radiative power, not fire counts or burned area. Record any unclear task wording
before starting. The MODIS benchmark, sample role and history checks below are
additional guided checks, not hidden requirements of the initial task.

Steps:

1. Open the homepage. Use Main calendar · estimates and observations, not Raw-data preview or Synthetic demonstration.
2. Choose Series = Harmonized · Terra + Aqua, Year = 2020, Inspect a date = 2020-08-01. Direct route:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01
3. Select the corresponding calendar cell or use View selected day details. Check the date in “Inspect a solar day”. Read estimate, S-NPP reference, benchmark, interval and sample role.
4. Change Series to VIIRS · Suomi-NPP. Inspect day/night turns and the native sum; return to the harmonized series.
5. Copy the URL into another tab. Use browser Back/Forward and check restoration of source, year and selected date.

Expected:

- Estimate 11,455.6 MW; S-NPP 10,966.4 MW; uncalibrated benchmark 9,358.3 MW.
- Empirical 80% interval 6,447.5–17,346.5 MW.
- Role: Previously examined date / post-hoc evidence, not independent validation.
- The native S-NPP daily sum matches the displayed reference without changing dates.
- Estimate, observation and benchmark are distinguishable. FRP is not labeled as a count of fires or burned area.

Report: wrong/stale values, lost URL state, hard-to-find details, ambiguous labels or a need for a user-friendly export/share summary. An absent export feature is a product opportunity, not an existing button the tester must find.

## UC2 — analyst compares years without mixing sensors

User need: “Compare 2020 and 2024 on the same indicator without inventing values for missing dates.”

Steps:

1. Select harmonized data, Year = 2020 and Compare with = 2024:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-02&obs_compare=2024
2. Find “Same series · two years”. Identify both years and the shared vertical axis.
3. Set “Compare a month/day” to 08-02. Inspect each year's value and use “Inspect date”; check the daily panel's year/date.
4. Inspect 08-01: 2024 has no publishable estimate. The gap must not become zero or a line through missing dates.
5. Restore the comparison, change the second year to 2023 and select 02-29 in the month/day inspector. The UI should explain that the date does not exist, especially on Safari, rather than rolling over to March or blanking the page.
6. Exercise Back/Forward and a copied URL. Selected series and years should survive. The chart inspector must restore its month/day through obs_compare_day rather than silently returning to 08-01.

Expected: 08-02 values are 17,241.5 MW in 2020 and 73,035.4 MW in 2024. Both lines use the same series. Identical comparison years are unavailable. Gaps interrupt lines, isolated values remain visible, and leap years do not shift March. No automatic annual “more fires” percentage is inferred.

Report: unclear year colors, clipped charts, unreadable text, missing scroll hints, stale inspection values or reliance on hover. Check whether the comparison is understandable using only the inspector.

## UC3 — communicator checks whether missing data mean no fire

Task: You are preparing a public explanation of Pantanal fire activity in
**2025**, but the calendar has few values. Determine whether this supports a
claim of little fire activity. Find one date without an estimate and one with an
estimate in that year; record the dates, available value and the app's explanation
of the gap. Explain whether a missing estimate means no fire, using what the site
says. Try this without the script first. The 2012/2026 and navigation checks below
are additional checks, not required to answer this basic task.

Steps:

1. Open:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2025&obs_date=2025-08-01
2. Check the annual value count and approval summary. Inspect 1 August, which has no publishable estimate.
3. Use Next available estimate: it should select 2025-10-05 and show 2,809.6 MW. Reopen the explicit 2025-08-01 gap link; it must stay unavailable. Then select 2026 and check its count. Interactive year changes may select the nearest valued date with an explanation; explicit gap links must not be shifted.
4. Test an unacquired date:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2012&obs_date=2012-01-01
5. Test an estimate without a complete S-NPP reference:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2012&obs_date=2012-03-10
6. Ask the tester to explain the difference between not acquired, no estimate and no complete S-NPP reference.

Expected:

- Six published estimates in 2025 and five in 2026 do not count days with fire.
- 2025-08-01 stays unavailable; 2025-10-05 shows 2,809.6 MW.
- 2012-01-01 is Not acquired: no invented zero or automatic jump to another day.
- 2012-03-10 has estimate 499.7 MW, benchmark 294.8 MW and an unavailable S-NPP reference because a complete turn pair is absent. Its role is training.
- Missing reference does not erase the estimate or create a fake observation. Training agreement is not validation evidence.

Report: null converted to zero, silent date replacement, infinite loading or copy that encourages “no fire”. If the distinction becomes clear only after André explains it, mark UNCLEAR and suggest wording.

## UC4 — evaluator examines the scientific evidence

User need: “What was tested, what improved, and which displayed results are not validation evidence?”

Steps:

1. Open Methodology:
https://chronoflare.vercel.app/?view=methodology
2. Find the registered test table: days/weeks, bias, MAE, benchmark, interval coverage and thresholds.
3. Locate the Plan A approval record and preserved v1 rejection. Follow evidence links and return to the app.
4. Find Before: uncalibrated MODIS benchmark and After: harmonized estimate. Identify axes, equality diagonal and interval bars.
5. Toggle Training period and Previously examined off; keep Independent test on. Restore all groups.
6. Open “Sample-role counts for the full published dataset”. Check published, paired and missing-reference counts. Toggle all groups off: require No groups selected and Showing 0 paired dates. Reload and verify that the empty selection survives.
7. Choose 2020-01-04 in Paired date. Test point taps, previous/next controls, clear selection and reload. Individual values must remain visible without hover; filters and the selected date must survive sharing. Open the same independent date in Calendar:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-01-04

Expected:

- Registered evaluation: 506 paired days / 40 weeks; weekly bias about −1.0%; MAE 1,675.5 MW versus 2,589.0 MW; Spearman 0.965; daily interval coverage 72.7%; median relative width 1.74. Results are expressed in text.
- The benchmark ranks weeks slightly better; the app does not claim improvement on every metric.
- The chart has 620 paired dates from 635 published estimates, with 15 missing S-NPP references. Paired/published by role: training 230/232, previously examined 161/161, independent 229/242.
- The 506-day registered evaluation is distinguishable from the stricter publication/chart subset. Filtering does not recalculate the official table.
- Both panels share logarithmic axes fixed across filters. Vertical bars are empirical intervals, not a time-series path.
- 2020-01-04 is independent: estimate 427.1 MW, S-NPP 1,082.6 MW, upper interval 957.9 MW. The reference lies outside the interval; that alone is not a bug or a claim of guaranteed coverage.
- Sparse recent years and the absence of an independent backward test remain visible.

Report: training presented as validation, plotted count mistaken for test size, changing axes, broken links, unclear empty states or unreadable graphics. Point values must persist in the inspector after touch and be available through its native keyboard date control. Hover alone is insufficient.

## UC5 — analyst locates a detection and inspects its source record

User need: “Where did a satellite record activity in the Pantanal, and what are the record's date, platform, FRP and confidence?”

Steps:

1. Open Map:
https://chronoflare.vercel.app/?view=map
2. Set Geographic view = Pantanal · IBGE 2025 and Detection source = VIIRS · S-NPP.
3. Select a valid UTC range within 2020-08-01 to 2020-08-15. Compare the displayed count with the table/pagination.
4. Click View on map for a row. Locate the selection and inspect UTC time, FRP, platform, raw confidence and record identity.
5. Switch to MODIS · Terra + Aqua, then Platform = Terra and Aqua. Check updates and that a previous-source selection is not displayed as belonging to the new source.
6. Toggle Satellite context and Land cover. MapBiomas should be optional and available only in its supported view. If an external provider fails, check the message and continued access to records.
7. Select Brazil download; check the explanation beside disabled land cover. Change table pages and scroll the table on mobile.
8. Return to Calendar. The app must not imply the map contains the exact records behind every calendar year/date.

Expected: filters, count, table and selected record agree. Confidence codes have names with raw values retained. The map is a separate unreviewed August 2020 batch. Context imagery is not a fire metric, burned-area product or proof of coverage. Missing tiles should not make records inaccessible. Horizontal table scrolling must not widen the entire page.

Report: wrong point, stale selection, opaque labels, clipped controls, inaccessible tables, misleading context imagery or unexplained tile failures. Exact historical calendar-to-map linkage is a potential future need, not a current promise.

## UC6 — analyst opens a shared result on a phone

User need: “During a meeting, I want to inspect a shared result on my phone, change dates and return to the same context.”

Steps:

1. Open UC1's URL in private browsing on iPhone/Safari and, if possible, Android/Chrome. No author login should be required.
2. Use the four calendar controls, scroll sideways to late-month days and select one. Assess whether the scroll cue reveals days 10–31.
3. Compare 2024 using the month/day inspector without hover; repeat UC2's leap-day check.
4. Visit Methodology, toggle chart groups, follow evidence links and return using browser Back. Check calendar filters.
5. Rotate the phone and repeat date selection. Internal table/chart scrolling is acceptable; global page overflow or lost state is not.
6. Enable reduced motion when available. On slow connectivity or browser throttling, inspect the loader: no simulated percent, invented processing stage or artificial delay after content is ready.
7. On desktop, use only keyboard: Tab to the active day, arrows to move focus, Enter/Space to select. Left/Right move dates, Up/Down move months, Home/End stay within the month. Only one day belongs in the Tab order; focus movement alone must not select.
8. Use Skip to content and, if available, VoiceOver/TalkBack to inspect a valued day and a missing-estimate day. Log excessive repetition or unclear identity.

Expected: phone/desktop values agree for the same context; controls do not overlap; invalid dates do not blank Safari; focus is visible; information is accessible without color/hover. Reduced motion is respected. Network errors produce readable feedback rather than fabricated data. Mark unavailable assistive-technology checks NOT TESTED.

## Issue report template

- ID, such as UC2-01; tester; device/OS/browser/version.
- Exact URL, scenario and step.
- User question and actions in order.
- Expected versus actual result.
- Task blocked, difficult or cosmetic? Always reproducible or intermittent?
- Screenshot/video and approximate timestamp; no secrets/private data.
- Category: data/interpretation, navigation, visual, accessibility or external network.
- Suggested priority: P0 = wrong science, false zero or broken core journey; P1 = essential task inaccessible or very difficult; P2 = clarity/presentation with a usable alternative.

## Closing questions

Can the tester explain observed versus estimated values, interpret a blank day, compare the same series across years, share context and recognize recent-year limitations? Can they identify training versus test evidence and understand the separate map batch?

Moving between the map, real calendar and demo must not inject generic fixture basis/region fields into real URLs. Saved demo choices use demo_* and restore when demo mode is selected. Verify history and copied links.

Record unmet needs such as a CSV export, shareable summary, translation or exact calendar-to-map linkage. Distinguish new product opportunities from broken promised behavior. Finish with passed scenarios, three main difficulties, demo blockers and items that can wait. Never change a model or scientific threshold to make a usability scenario pass.

## Retest after discovery feedback

Windows 10 / Firefox 160.0 feedback: case 1 was not discoverable without the
script; the tester could not choose between the main calendar and raw preview,
and did not know day squares opened details. The benchmark field was reported
absent (not merely showing Unavailable). The precise mode/source at that moment
was not captured, so the cause remains unconfirmed. Case 3 was not discoverable,
and the detailed script itself was not understood; it was not executed.

Retest the clarified dataset labels and explanation, day-square instruction and
View selected day details button. In the main calendar's Harmonized series,
2020-08-01 must show the benchmark as 9,358.3 MW. The raw preview explicitly lacks
harmonized estimates and benchmark; switching there must not imply data loss.

For the basic missing-data task, open the harmonized 2025-08-01 link, reveal its
details, explain why the gap does not mean no fire, and use Next available
estimate to reach 2025-10-05 (2,809.6 MW). Check this first without the script.
The Portuguese handoff now separates this three-step task from optional edge
cases. These changes require user retesting; they do not establish a passed
usability result.

## Second attempt and task clarification

André reported UC1's guided steps passed on Windows 10 / Firefox 160.0 and the
9,358.3 MW benchmark was present. The unguided attempt remained a reported fail.
He subsequently clarified that his request for a more detailed “command” referred
to the task wording in this document, not a UI control. The original report is
preserved; this does not establish either a passed unguided task or a confirmed
remaining UI defect.

UC1 and UC3 now state concrete outputs separately from additional technical
checks. On retest, record task comprehension separately from unaided execution.
UC3 still requires execution/retesting; no successful outcome is inferred.
