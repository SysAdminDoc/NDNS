<p align="center">
  <img src="https://www.google.com/s2/favicons?sz=128&domain=nextdns.io" alt="NDNS" width="64" />
</p>

<h1 align="center">NDNS</h1>
<p align="center">
  <strong>NextDNS Ultimate Control Panel</strong><br/>
  A userscript that adds a floating control panel, analytics dashboard, and power-user tools to the NextDNS web interface.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.4.0-7f5af0?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey%20%7C%20ScriptMonkey-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/github/license/SysAdminDoc/NDNS?style=flat-square" alt="License">
</p>

---

## Overview

NDNS transforms the NextDNS dashboard at [my.nextdns.io](https://my.nextdns.io) into a power-user environment. It injects a persistent floating panel with quick actions, an API-driven analytics dashboard, domain management tools, and deep customization options — all running client-side as a userscript.

> Also available as a Chrome extension: [BetterNext](https://github.com/SysAdminDoc/BetterNext)

---

## Features

| Category | Details |
| --- | --- |
| **Floating Control Panel** | Draggable, resizable, persistent position. Quick navigation, domain filters, log controls, and action buttons. |
| **Analytics Dashboard** | Replaces the default analytics page with custom API-driven views: stat cards, ring charts (status, DNSSEC, encryption, protocols, IP versions), bar charts (top domains, blocked domains, devices), data tables, and CSV/JSON export. |
| **Log Enhancements** | Filter by Allowed / Blocked / Cached. Hide specific domains. Compact mode. Auto-refresh with configurable interval. Real-time log counters. |
| **Domain Management** | One-click allow/deny from logs. Bulk delete tools with progress tracking. Domain action history. CNAME chain display. |
| **Profile Tools** | Full profile import/export (JSON). Cross-profile config sync. DNS rewrite management from the settings modal. |
| **Parental Controls** | Quick-toggle parental control categories and recreation time directly from the settings modal. |
| **HaGeZi Integration** | One-click sync of TLD blocklists and allowlists from HaGeZi's curated adblock lists. |
| **Webhook Alerts** | Send domain query events to Discord, Slack, or any webhook URL. Configurable domain pattern matching. |
| **Theming** | Dark, Dark Blue, and Light themes. List page theme override. Ultra-condensed mode. Custom CSS injection. |
| **Scheduled Logs** | Automatic log downloads on a configurable schedule with desktop notifications. |

---

## Installation

### Requirements

A userscript manager extension:
- [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
- [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
- [ScriptMonkey / EspressoMonkey](https://github.com/SysAdminDoc/EspressoMonkey) (Chrome)

### Install

1. Install a userscript manager from the list above
2. **[Click here to install NDNS.user.js](https://raw.githubusercontent.com/SysAdminDoc/NDNS/main/NDNS.user.js)** — your userscript manager will prompt to install
3. Visit [my.nextdns.io](https://my.nextdns.io)

### Manual Install

```bash
git clone https://github.com/SysAdminDoc/NDNS.git
```

Open your userscript manager, create a new script, and paste the contents of `NDNS.user.js`.

---

## Setup

1. Install the userscript and visit any NextDNS page
2. The floating panel appears with a prompt to set your API key
3. Click **"Take Me There!"** to navigate to your NextDNS account page
4. Click **"Capture Key & Continue"** — your key is stored locally via `GM.setValue`
5. NDNS is now fully operational

> Your API key is stored locally in your userscript manager's storage. It never leaves your browser and is only used for direct requests to the NextDNS API.

---

## Grants Required

The userscript requires the following `@grant` permissions:

| Grant | Purpose |
| --- | --- |
| `GM_addStyle` | Injects CSS for the panel, themes, and analytics dashboard |
| `GM.setValue` / `GM.getValue` / `GM.deleteValue` | Persistent local storage for settings, API key, and UI state |
| `GM_xmlhttpRequest` | Cross-origin API requests to `api.nextdns.io` (bypasses CORS) |

---

## File Structure

```text
NDNS/
├── NDNS.user.js    # The complete userscript
└── README.md
```

---

## Related Projects

- **[BetterNext](https://github.com/SysAdminDoc/BetterNext)** — Chrome extension version with identical features, packaged as a Manifest V3 extension
- **[EspressoMonkey](https://github.com/SysAdminDoc/EspressoMonkey)** — Chrome Manifest V3 userscript manager extension

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/SysAdminDoc"><strong>Matt Parker</strong></a>
</p>
