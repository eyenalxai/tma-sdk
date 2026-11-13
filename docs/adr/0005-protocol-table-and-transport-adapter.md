# One protocol table and one transport adapter

The Mini App client speaks one wire protocol across native clients, the legacy embedded webview and Telegram Web. Wire names, parameters, response events, introduced versions, raw payloads and per-platform capability live in one method table. Outbound channel selection and inbound bridge installation live in one transport adapter. Callers use typed `invoke`, `on`, `request`, `supports`, `mayInvoke` and `supportsParam` instead of knowing JSON envelopes, proxy globals, origins or version numbers.

The four-module wire layer was rejected because transport order, target origin, payload shape and version gates could disagree; they did, and Web K was pinned to the wrong origin. A compatibility wrapper was rejected because the release is breaking and the old modules would keep the disagreement alive.

This supersedes ADR 0004: the protocol module owns event dispatch and the inbound bridges; the session still owns teardown and the feature controllers.
