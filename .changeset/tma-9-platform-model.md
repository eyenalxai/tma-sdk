---
"@eyenalxai/tma-sdk": minor
---

Replace the platform boolean with a capability table. `getPlatform(name)` reports `kind`, `supportsViewport` and `isEmbeddedWeb` for every observed Telegram client, and viewport mount requests the viewport only when the platform answers it.

Breaking release (0.3.0):

- `isDesktopPlatform` is removed; read `getPlatform(name).kind` or `getPlatform(name).supportsViewport` instead.
