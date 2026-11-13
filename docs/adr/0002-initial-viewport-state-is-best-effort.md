# Initial viewport state is best effort

Session mount does not wait for safe-area state. Safe-area requests are best-effort because some clients (Web K and Unigram) never answer them, and awaiting them stalled mount by up to five seconds; macOS is also excluded from the content-safe-area request because it answers with the wrong event. The viewport-height request is awaited only when the platform provides a usable height. macOS answers with a null payload, so it is skipped and the session uses the window height. The trade-off is that some viewport state arrives asynchronously after mount.
