# Separate active observation routing from saved demo context

The shared navigation store historically serialized fixture defaults such as
`basis=viirs` and `region=pantanal-pilot` whenever the user changed views. Those
fields describe the synthetic calendar and could appear beside the actual
`obs_source=harmonized` selection, making shared links misleading.

Application navigation now opts into scoped routing:

- Real observations, the map, experimental preview and research keep their own
  existing parameters. No synthetic basis, region or date is invented on navigation.
- Explicit saved synthetic choices use `demo_basis`, `demo_date`, `demo_region`,
  `demo_compare`, `demo_compare_basis` and `demo_years` outside the demo context.
- Choosing `calendar_data=demo` restores those choices to the legacy fixture
  controls and removes the duplicate saved names. Leaving demo mode saves them
  again, so copied links and browser history retain context.
- Old explicit fixture parameters are migrated, not discarded. The default
  `view=calendar` is omitted; map and methodology views remain explicit.
- The application passes the fixture dataset to the shared selection hook only
  while demo mode is active. Cached synthetic data cannot validate or normalize
  an active real-observation selection.

The legacy store/link functions retain their original behavior by default;
application callers opt into the scoped serializer. Observation selection,
scientific assets, model, approval and published values are unchanged.

Regression coverage includes new real/map navigation, old links, demo re-entry,
Home links, empty query strings, hash preservation, browser history and copied
links. Browser checks also retain the paired inspector, role filters, comparison
month/day, leap-date handling and sparse-year navigation delivered in PRs #55–#56.
Actual phone Safari testing remains a deployment check.
