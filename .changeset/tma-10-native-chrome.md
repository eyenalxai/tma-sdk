---
"@eyenalxai/tma-sdk": minor
---

Reconcile native chrome when the session starts. The back-button controller gains `sync()`, which posts the desired visibility once even when the store already matches, so a native reload converges; `show()` and `hide()` keep sending only changes. Fullscreen transitions treat `ALREADY_FULLSCREEN` as success for entering and exiting the mode, while `UNSUPPORTED` still rejects. Partial `safe_area_changed` and `content_safe_area_changed` payloads are accepted and merged into the stored insets instead of replacing them.
