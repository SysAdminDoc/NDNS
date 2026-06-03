# Changelog

All notable changes to NDNS will be documented in this file.

## [v3.4.2] - 2026-06-03

### Fixed
- **"Download Log" button fails** ([#3](https://github.com/SysAdminDoc/NDNS/issues/3)) — The NextDNS `/logs/download` endpoint 302-redirects to a pre-signed public file URL on a different host; following that redirect with the `X-Api-Key` header re-attached failed with "Failed to fetch", so both the panel **Download Log** action and the **HOSTS export** silently errored. Now requests `?redirect=0` to get the public file URL as JSON, then fetches that URL directly with no auth header. Shared via a new `fetchLogsCsv()` helper.
- **Low-contrast secondary text** ([#2](https://github.com/SysAdminDoc/NDNS/issues/2)) — Panel footer, section labels, and muted metadata used `--panel-text-secondary` values that dropped below WCAG AA (4.5:1) once the common `opacity: 0.7` was applied. Darkened/lightened the secondary text token per theme (dark `#94a1b2`→`#c0c8d4`, light `#555b6e`→`#33384a`, dark-blue `#7a8a9a`→`#b2bdcb`), plus the dark-blue `.text-muted` override and the onboarding API-page link. All now clear AA, including at 0.7 opacity.

## [v3.4.1] - 2026-05-21

### Fixed
- **Allowlist / Denylist domain text unreadable** ([#1](https://github.com/SysAdminDoc/NDNS/issues/1)) — Both list pages paint deep-green (`#0a2915`) and deep-red (`#260600`) backdrops on `.list-group-item` and friends but inherited the NextDNS dark Bootstrap text color on top, so domain names rendered near-invisibly. Mirrors the same fix that landed in BetterNext v3.5.1: explicit `color: #d0eedd` (allowlist) / `#f5d4d0` (denylist) on item containers, descendants, form controls, headers, and placeholders. Contrast now ~10:1.

## [v3.4.0] - 2026-05-17

- Added: Add @updateURL and @downloadURL to userscripts
- Initial commit — NDNS v3.4.0 userscript
