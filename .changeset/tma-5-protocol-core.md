---
"@eyenalxai/tma-sdk": minor
---

Replace the four wire modules with one protocol table and one transport adapter. The protocol exposes typed `invoke`, `on`, `request`, tri-state `supports`, `canInvoke` and parameter-level availability; it routes through the native proxy, the legacy notify channel or an iframe with a Telegram Web origin allowlist, installs all three inbound receive-event globals, and reports the method, platform and version on a request timeout.

Breaking release (0.3.0):

- The internal `post-event`, `version`, `event-schemas`, `event-bridge`, `event-hub` and `request` modules are removed with no compatibility layer.
- `miniApp.ready()` no longer sends `web_app_ready` on `tdesktop` and `windows`, where the client does not implement the method.
