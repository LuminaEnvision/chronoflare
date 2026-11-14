# Coverage delivery 2 — engineering review

**Update:** The [v1.1 review](coverage-v1.1-review.md) records resolved answers,
the implemented solar helper and the remaining source reconciliation. The text
below preserves the initial v1.0 assessment.

**Received:** November 14, 2026. **Supplier:** André. **Document version:**
`v1.0-handoff-2`, declared registration `2026-11-14T14:26:00-03:00`.

The supplied document is scientific input for review, not an instruction to bypass
existing validation or evidence requirements. It proposes the method
`operational_schedule_and_turn_activity_uncorrected_for_clouds_v1` and supplies a
sensor availability/outage lookup. The proposal is preserved in
`science/configs/sensor_outages.proposed.json`, explicitly disabled and pending
source verification. No runtime component consumes it. Its source document hash
is recorded; no event source URL was supplied.

## What this contributes

- Explicit recognition that positive-detection CSVs cannot distinguish missing
  observations from a genuine lack of detections.
- A useful negative-evidence mechanism: a verified complete instrument outage can
  prevent a false observed zero. A known absence of operation must never be
  interpolated or silently filled.
- A distinction between the Terra-only era and Terra+Aqua availability, rather
  than claiming equivalent observation conditions.
- `overpass_count=null` without an orbital footprint/catalogue measurement.
  Counting detection-bearing day/night classes is not counting overpasses.
- An explicit cloud limitation. That limitation should remain visible if an
  operational proxy is eventually approved.

## What prevents direct integration

| Issue | Finding | Required resolution |
|---|---|---|
| Event evidence | The outage JSON names events but provides no official URL, product bulletin or quoted start/resumption times | Supply NASA/NOAA/product-specific references per event and clarify inclusive boundaries and time zone |
| S-NPP end date | `2026-11-02` matches the last date displayed in the supplied download catalogue screenshot; that alone does not prove permanent mission or product termination | Establish whether it is a current archive-availability cutoff, processing delay, product discontinuation or instrument shutdown. Do not permanently disable later dates from this screenshot |
| Positive coverage evidence | Detections elsewhere in South America and nominal swath width do not locate a swath over the AOI, establish cloud-free pixels or prove both turns covered the region | Define the evidence area and algorithm; supply measured footprints/clear-sky support or explicitly retain unknown coverage. Absence from the outage list cannot by itself authorize zero |
| Definition of operational windows | The prose mixes fixed nominal windows, schedule status and detected D/N activity without a complete procedure for missing evidence | Define exactly how each platform/turn becomes operational, unavailable or unknown, and how positive detections conflicting with an outage are handled |
| Temporal convention | The proposed classifications use local solar dates, but source timestamps are UTC and outage dates have no time-zone convention | Specify the solar-date rule and how UTC outage boundaries map to it; define partial-day events |
| Meaning of fraction | Operational platform/turn fraction is not AOI cloud-free fraction or spatial coverage. Copying AOI status to every H3 cell does not prove cell coverage | Define and label this as a proxy if approved; do not present it as measured spatial coverage |
| Partial zero | The proposal permits some `partial` records with value zero; the current schema explicitly requires `coverage_flag=ok` for zero. Its example of a calibrated Terra stratum does not clearly resolve the missing peak-platform condition | Provide one deterministic truth table and evidence requirements. A contract change must be deliberate, versioned and tested; do not relax validation silently |
| Period boundaries | All four sample objects set `period_end=period_start` | Use the next day as the exclusive end for daily records, e.g. `2020-08-15` to `2020-08-16` |
| Scientific examples | The examples omit required contract metadata. Harmonized/estimated examples require approval and uncertainty fields. Their numerical values are not reproduced from the delivered CSVs; February 10 is outside the received August window | Treat them as illustrative specifications until complete records, calculation code and supporting evidence are supplied; do not publish the values as verified measurements |
| AOI | The earlier polygon was reported as generated with Gemini without a traceable institution/source | Use a verified AOI before making Pantanal-specific zero or coverage claims. The raw map now offers a verified IBGE 2025 reference subset alongside the national view; the earlier generated polygon is not used. Aggregate coverage still needs its own reviewed evidence |

The referenced `science/scripts/aggregate.py` does not exist in the current
repository. The delivered JSON does not implement the scientific aggregator.

## Conservative behavior today

The raw map shows supplied detections only. It does not emit daily aggregates,
coverage fractions, zeros, outage classifications or a calibrated index. Empty
filters mean no matching records, with coverage still unknown. The calendar and
comparison chart continue using fixtures and existing approval gates.

Verified outage data can later serve as negative evidence, but the existence of
positive detections and the absence of listed outages must not be promoted into
proof of complete AOI observation. Neither this review nor CI approves a scientific
coverage method. `science/configs/decisions.json` remains unchanged.

## Request to the scientific owner

Please provide authoritative event URLs, clarify the S-NPP catalogue cutoff,
formalize platform/turn evidence and UTC-to-local-date handling, resolve partial
zeros against the schema, and replace the illustrative objects with complete
reproducible records. Engineering can then implement the agreed classifier and
contract tests in a separate change. The historical calendar should remain
synthetic until the broader reviewed data handoff is complete.
