# Multi-year scientific pipeline

## Stage 2: initial v1.0 acquisition design

The latest design is v1.1, described in the support-expansion section below.

The versioned plan selects 63 consecutive solar days starting February 1 and
August 1 in 2013–2015, 2017–2021: 1,008 candidate dates, two seasonal windows,
eight years. It prioritizes 2017–2021 for forward training/testing before the
2013–2015 backward holdout. The scientific train/test windows remain unchanged.
Dates were selected before any real calibrated holdout scoring. These windows
are a bounded feasibility sample, not a representative full-year trend study.

Each source/block downloads 64 UTC dates to close the last fixed solar day.
MODIS_SP retains Terra and Aqua separately; VIIRS_SNPP_SP is the sole target.
The pinned official IBGE boundary remains the spatial reference. The bbox is a
transport filter; exact point-centre clipping happens before observed aggregation.
The plan contains 416 nonoverlapping requests of at most five days each. It does
not request Brazil-wide archives or introduce NOAA-20, NRT or an AOI change.

Candidate dates do not guarantee positive same-turn observations, clear-sky
coverage or enough eligible weeks. The sufficiency gate must measure actual
support. Any later window expansion must be versioned before its model evaluation;
never cherry-pick dates from holdout errors. Backward training may use dates that
are forward holdout, but its fitted objects must remain independent and must not
feed forward selection or residuals.

The current FIRMS key is sufficient. Download errors, expired artifacts or sample
shortfalls must be reported explicitly. Model approval remains separate from
source acquisition and from publishing application data.

## Version 1.1 support expansion

The completed v1.0 input had 162 forward candidate test days but only 17 eligible
weeks, and 106 backward days but only eight weeks. Both are below the registered
25/15-week minima; no model fitting or empirical holdout scoring occurred.
Version 1.1 therefore completes every solar date from January 20, 2012 through
December 31, 2015, and adds the same fixed seasonal windows in consecutive years
2022–2024. This expands support without selecting dates using fitted-model errors.
The original eight-year requests remain byte-for-byte identical plan entries.

The expanded design has 2,450 candidate solar dates, 32 nonoverlapping solar
blocks and 1,012 bounded requests in total. Transport padding can overlap one UTC
date between neighboring solar blocks; exact solar clipping prevents duplicate
scientific dates. The remaining 596 requests reuse the 416 existing downloads.
Even these larger inputs are a bounded Pantanal subset, not entire global bases
or full annual forward-validation coverage. Known S-NPP gaps remain missing,
never zeros. Actual support must be checked again before fitting.
