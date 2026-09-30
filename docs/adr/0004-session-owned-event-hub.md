# Session-owned event hub

Each Mini App session owns an event hub over a refcounted global event bridge instead of registering handlers in a module-global registry. Session teardown disposes the hub and releases the bridge reference, so ownership and lifecycle are explicit and testable. The module-global registry was rejected because it hides which session owns a handler, leaks subscriptions across sessions, and makes teardown order hard to reason about.
