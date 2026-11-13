import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createDialogs } from "./dialogs"

const readParams = (eventData: string | undefined): unknown => JSON.parse(eventData ?? "null")

describe("createDialogs", () => {
  it("returns the pressed button id and tracks the open state", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const dialogs = createDialogs(environment.runtime)
      expect(dialogs.supported).toBe(true)
      expect(dialogs.state.get().isOpen).toBe(false)

      const shown = dialogs.actions.show({
        title: "Delete?",
        message: "This cannot be undone",
        buttons: [
          { id: "delete", type: "destructive", text: "Delete" },
          { id: "cancel", type: "cancel" },
        ],
      })
      expect(dialogs.state.get().isOpen).toBe(true)
      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        title: "Delete?",
        message: "This cannot be undone",
        buttons: [
          { id: "delete", type: "destructive", text: "Delete" },
          { id: "cancel", type: "cancel" },
        ],
      })

      environment.emit("popup_closed", { button_id: "delete" })

      expect(await shown).toBe("delete")
      expect(dialogs.state.get().isOpen).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("returns null when the popup closes without a button", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const dialogs = createDialogs(environment.runtime)

      const shown = dialogs.actions.show({
        message: "Hello",
        buttons: [{ type: "ok" }],
      })
      environment.emit("popup_closed", {})

      expect(await shown).toBeNull()
      expect(dialogs.state.get().isOpen).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("keeps the open state until every queued popup closes", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const dialogs = createDialogs(environment.runtime)

      const first = dialogs.actions.show({ message: "One", buttons: [{ type: "ok" }] })
      const second = dialogs.actions.show({ message: "Two", buttons: [{ type: "ok" }] })
      expect(dialogs.state.get().isOpen).toBe(true)

      environment.emit("popup_closed", { button_id: "ok" })
      await first
      expect(dialogs.state.get().isOpen).toBe(true)

      environment.emit("popup_closed", { button_id: "ok" })
      await second
      expect(dialogs.state.get().isOpen).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("resolves alert with the ok button", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const dialogs = createDialogs(environment.runtime)

      const alerted = dialogs.actions.alert("Saved")
      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        message: "Saved",
        buttons: [{ type: "ok" }],
      })

      environment.emit("popup_closed", { button_id: "ok" })

      await alerted
      expect(dialogs.state.get().isOpen).toBe(false)
    } finally {
      environment.dispose()
    }
  })

  it("resolves confirm with a boolean", async () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      const dialogs = createDialogs(environment.runtime)

      const confirmed = dialogs.actions.confirm("Continue?")
      expect(readParams(environment.posts[0]?.eventData)).toEqual({
        message: "Continue?",
        buttons: [
          { id: "ok", type: "ok" },
          { id: "cancel", type: "cancel" },
        ],
      })
      environment.emit("popup_closed", { button_id: "ok" })
      expect(await confirmed).toBe(true)

      const cancelled = dialogs.actions.confirm("Continue?")
      environment.emit("popup_closed", { button_id: "cancel" })
      expect(await cancelled).toBe(false)

      const dismissed = dialogs.actions.confirm("Continue?")
      environment.emit("popup_closed", {})
      expect(await dismissed).toBe(false)
    } finally {
      environment.dispose()
    }
  })
})
