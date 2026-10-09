# Admin revalidation3 — technical fixes

Source: supplied third QA report dated2026-10-09, treated as observations. Base frontend2197034a, canonical origin Gus-Padbol/padbol-match. Isolated branch fix/admin3-final-20261009; no production data modifications, backend permission changes or outbound messages.

## N8 — authenticated partner-search listing

Confirmed cause: TorneoVista requested the partner listing without Authorization, although the backend correctly requires authentication because results include private player contact data. The frontend now forwards the existing session. An anonymous view makes no listing request. Personal enrollment/invitation requests preserve existing authentication. No public access or administrator impersonation is introduced. Two transport tests cover authenticated and anonymous reads; deployed authenticated receipt remains the release owner's check.

## G10 — date presentation

One date formatter now gives numeric day/month and full year for the selected locale, plus24-hour hour/minute for timestamps. Calendar-only ISO dates preserve their stored day and do not gain an invented midnight time. Invalid dates show the existing missing-value marker. Applied to tournament rows, membership dates, PadCoins movements/redemptions, scoreboard/history, role expiry/history, notification history, player activity, instructor timestamps, venue reviews and waitlist timestamps, next-charge dates, and incentives update time. Locale is retained where supplied. Conversational calendar headings/month-period labels and CRM advisor/Argentina timezone context remain intentional date contexts, not stored-data changes.

## G11 — native controls

Date/time/month fields inherit the admin font, including native datetime segments. Native file-picker buttons retain their browser accessibility and selection behavior, with existing admin theme colors, border, radius and44px minimum height. No upload or selected-file state was changed. Browser visual verification is not claimed by source/unit tests.

## Data/configuration findings

S01 historical venue references, G06 QA cleanup, ME01 actual USD plan/content and RO02 role/user records were not modified. Existing detailed audit identifies the required owner criteria. C01 sender/provider and protected intake configuration are handled separately by the release owner. This patch does not claim all60 findings closed or verify production writes. NG public contact validation is a separate bundle/API review.

## Validation

Initial focused date/membership/auth transport tests:39 passed. Final complete frontend suite:150 suites,1182 tests passed; unchanged assertions except the previously required month-word date expectation now requires the chosen numeric date convention. Tests cover local24-hour timestamps, full-year locale formatting, invalid calendar dates, calendar day preservation, existing-session forwarding and anonymous no-request. Final production compilation and independent review are required before publication. No production form was submitted.
