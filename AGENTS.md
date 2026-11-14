# Project working language

Use English for application text, accessibility labels, metadata, CLI output,
errors, tests, code comments, operational/scientific documentation, commit
messages, and pull requests. Keep locale-sensitive app formatting in English.

Documents specifically addressed to André under `docs/handoff/` may remain in
Portuguese at the project owner's request. Proper names and externally defined
API/schema identifiers retain their spelling.

Run `npm run language:check` together with the relevant existing checks before
submitting a change. The language check detects common Portuguese regressions;
human review is still required for new copy and binary documents.
