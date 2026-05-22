# Changelog

All notable changes to NDNS will be documented in this file.

## [v3.4.1] - 2026-05-21

### Fixed
- **Allowlist / Denylist domain text unreadable** ([#1](https://github.com/SysAdminDoc/NDNS/issues/1)) — Both list pages paint deep-green (`#0a2915`) and deep-red (`#260600`) backdrops on `.list-group-item` and friends but inherited the NextDNS dark Bootstrap text color on top, so domain names rendered near-invisibly. Mirrors the same fix that landed in BetterNext v3.5.1: explicit `color: #d0eedd` (allowlist) / `#f5d4d0` (denylist) on item containers, descendants, form controls, headers, and placeholders. Contrast now ~10:1.

## [v3.4.0] - 2026-05-17

- Added: Add @updateURL and @downloadURL to userscripts
- Initial commit — NDNS v3.4.0 userscript
