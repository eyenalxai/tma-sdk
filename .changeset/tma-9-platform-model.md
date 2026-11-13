---
"@eyenalxai/tma-sdk": minor
---

Replace the platform boolean with a capability table. `getPlatform(name)` reports `kind`, `supportsViewport` and `isEmbeddedWeb` for every observed Telegram client, and viewport mount requests the viewport only when the platform answers it.

Breaking release (0.3.0):

- `isDesktopPlatform` is removed. Read `getPlatform(name).kind` for the client class (`mobile`, `desktop`, `web` or `unknown`), and `getPlatform(name).supportsViewport` for whether the client provides a usable viewport height. The old desktop layout set is `kind === "desktop" || kind === "web"`. macOS no longer requests the null viewport and uses the window height.
