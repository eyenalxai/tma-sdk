# Security Policy

## Reporting a Vulnerability

Do not open a public GitHub issue for a suspected vulnerability. Report it privately through GitHub Security Advisories for this repository.

Please include the affected version, a minimal reproduction, impact, and any relevant Telegram client or Node.js version details.

## Bot Token Handling

The server entry point requires a Telegram bot token for signature verification. Keep that token in server-only configuration. Never send it to the browser, commit it to Git, or include it in logs.

Telegram Mini App init data can identify real users. Avoid logging raw init data in production and do not commit realistic init-data payloads to this repository.
