# Roadmap

Userscript enhancement for the NextDNS web dashboard — floating control panel, API-driven analytics, domain tools, webhooks. Roadmap mirrors BetterNext (the Chrome extension sibling) plus userscript-specific polish.

## Planned Features

### Analytics Dashboard
- Historical time-series beyond the dashboard's default windows (90d / 1y rollups)
- Per-device drill-down with per-app breakdown (resolve User-Agent guesses)
- Exportable PDF report (branded, for MSP customers)
- Anomaly detection: spike in blocked queries per category flagged with desktop notification
- Cross-profile analytics merge (aggregate across all your profiles)

### Domain Management
- Bulk import: paste a newline-separated list into allow/deny
- Wildcard builder UI (regex helper + live preview against recent logs)
- Domain tag editor so the HaGeZi sync doesn't overwrite local curation
- Undo stack for allow/deny actions with 10-step history
- Domain-of-the-day: randomly surface a queried domain for review

### HaGeZi & Blocklists
- Per-list version tracking + diff-view on update
- Scheduled auto-sync (weekly) with desktop notification on change
- Conflict resolution UI (domain appears in allow + deny)
- Local blocklist import (paste hosts file / AdBlock syntax)

### Webhooks
- Webhook filter expressions (domain regex, device, status, time window)
- Payload template editor (Discord embed, Slack block-kit, generic JSON)
- Webhook test button with last-5 deliveries log
- Rate-limit guard (drop duplicate events within N seconds)

### Parental Controls
- Weekly schedule UI (heatmap-style time block editor) beyond recreation time
- Per-device override scheduling
- Content-category bulk-toggle presets (Safe Mode, Work Mode, Chill Mode)

### UX / Platform
- Theme Studio: custom CSS editor with live preview and export/import
- Compact vs roomy density toggle
- Keyboard shortcut picker (rebindable) — currently no shortcuts
- Mobile-viewport layout for the floating panel
- Firefox parity verification on every release (Violentmonkey + Tampermonkey)

## Competitive Research
- **Pi-hole admin UI** — richer network-level analytics; mirror top-domain treemap and tail-log UX.
- **AdGuard Home** — better schedule editor and bulk list management; borrow its list-manager layout.
- **Control D dashboard** — clean profile-switcher UI, good reference for the cross-profile merge.
- **BetterNext** (sibling repo) — keep feature parity; CI diff on every release to catch drift.

## Nice-to-Haves
- Browser-side DoH verification indicator (are you actually using NextDNS right now?)
- Per-tab / per-origin query log filter
- Query replay: send the same DNS query from the browser for debugging
- CLI twin (Node) for headless export of analytics to CSV via the same NextDNS API
- Public read-only dashboard share link for MSP customers
- IndexedDB cache of last 24h logs for offline browsing

## Open-Source Research (Round 2)

### Related OSS Projects
- https://github.com/hjk789/NXEnhanced — NextDNS QoL browser extension: allow/deny buttons in logs, domain hiding, date-filter log loading, relative/absolute timestamps
- https://codeberg.org/celenity/analyticsplus-for-nextdns — Analytics+ extension, bumps domain list from 6 → 50 via request rewriting
- https://github.com/vietthedev/hagezi-to-nextdns — HaGeZi list fetcher that pushes into NextDNS allow/deny lists
- https://github.com/MrTakedi/nextdns-tools — log downloader with pagination (2-year retention), statistics dashboard, favicon integration
- https://github.com/celenityy/nextdns-settings — curated NextDNS config recommendations (content for documentation/preset ideas)
- https://github.com/doubleangels/nextdnsmanager — Android NextDNS settings manager (reference for mobile UX)
- https://github.com/nextdns/api — official API docs, schema source of truth

### Features to Borrow
- In-log allow/deny buttons with "add root domain" / "add specific" / "edit-then-add" options (NXEnhanced) — biggest daily-use win, currently NDNS lacks this
- Client-side log hiding rules (hide crashlytics, telemetry noise) separate from blocklists (NXEnhanced)
- Request-rewrite trick to unlock 50-domain analytics (Analytics+) — implement as an NDNS toggle, undocumented but widely used
- Favicon-on-domain in logs/lists via `icons.duckduckgo.com` or NextDNS favicon service (nextdns-tools) — already common but worth auditing NDNS coverage
- HaGeZi / OISD / 1Hosts bulk-import wizard (hagezi-to-nextdns) — fetch + chunked POST with NextDNS API ratelimit handling
- Log export to CSV/JSON with 2-year pagination (nextdns-tools)
- Statistics dashboard: unique domains, device counts, blocked ratios (nextdns-tools) — supplements native analytics

### Patterns & Architectures Worth Studying
- Request-interception via fetch/XHR hook to rewrite API query params before they hit NextDNS backend (Analytics+) — userscript-level, no server needed
- Chunked API pagination with exponential backoff for large log pulls (nextdns-tools) — NextDNS ratelimits aggressively on the logs endpoint
- Blocklist merge with deduplication and per-list provenance tracking (hagezi-to-nextdns) — lets users see "this domain came from HaGeZi Multi"
- Cross-session floating panel state that persists via `GM_setValue` with versioned schema — survives NDNS UI redesigns
