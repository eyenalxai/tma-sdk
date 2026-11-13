---
"@eyenalxai/tma-sdk": minor
---

Serialize one request per Telegram method. A second call for the same method queues behind the active one in call order and starts its own wire request when the first settles. A queued call's timeout starts only when it takes its turn, and a per-request `signal` aborts that call alone, including before its turn.

Replies now correlate on the id the request sent: `req_id` for clipboard, custom method, request-chat and device/secure storage requests, and `slug` for invoices. A stale reply for another id no longer settles the wrong request, and callers no longer pass a predicate to read the payload themselves.
