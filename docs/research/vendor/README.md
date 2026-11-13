# Vendored Telegram Web App script

`telegram-web-app.js` is the official script from <https://telegram.org/js/telegram-web-app.js>, fetched 2026-11-13 (`Last-Modified: 2026-11-09`, sha256 `baa788a6f686f4238db1b82ce8e76470930af7411b18b521ebb95a2c1480a267`).

The protocol completeness test reads this file in both directions. It fails when a public wire method or event in the script is missing from `src/lib/protocol/methods.ts`, and when a table entry is absent from the script. Telegram Web's internal `getUserMedia` shim methods and events are excluded from the public table, as are a few native-only entries the script never emits. The file is not published with the package.
