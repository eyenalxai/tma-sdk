---
"@eyenalxai/tma-sdk": minor
---

Replace the four wire modules with one protocol table and one transport adapter. The protocol exposes typed `invoke`, `on`, `request` and tri-state `supports`; it routes through the native proxy, the legacy notify channel or an iframe with a Web K-safe origin allowlist, installs all three inbound receive-event globals, and reports the method, platform and version on a request timeout.
