import { describe, expect, it } from "bun:test"

import type { ViewportState } from "./viewport"
import type { ViewportCssVariableTarget } from "./viewport-css-vars"

import { createStore } from "./store"
import { initialViewportState } from "./viewport"
import { bindViewportCssVariables, viewportCssVariables } from "./viewport-css-vars"

const createTarget = () => {
  const properties = new Map<string, string>()
  const target: ViewportCssVariableTarget = {
    style: {
      setProperty: (property, value) => {
        properties.set(property, value ?? "")
      },
      removeProperty: (property) => {
        properties.delete(property)
        return ""
      },
    },
  }

  return { properties, target }
}

const createState = (overrides: Partial<ViewportState> = {}): ViewportState => {
  return {
    ...initialViewportState,
    height: 640,
    width: 360,
    stableHeight: 620,
    safeAreaInsets: { top: 1, bottom: 2, left: 3, right: 4 },
    contentSafeAreaInsets: { top: 5, bottom: 6, left: 7, right: 8 },
    ...overrides,
  }
}

describe("viewportCssVariables", () => {
  it("maps the viewport state to the documented CSS variables", () => {
    expect(viewportCssVariables(createState())).toEqual([
      ["--tg-viewport-height", 640],
      ["--tg-viewport-stable-height", 620],
      ["--tg-safe-area-inset-top", 1],
      ["--tg-safe-area-inset-bottom", 2],
      ["--tg-safe-area-inset-left", 3],
      ["--tg-safe-area-inset-right", 4],
      ["--tg-content-safe-area-inset-top", 5],
      ["--tg-content-safe-area-inset-bottom", 6],
      ["--tg-content-safe-area-inset-left", 7],
      ["--tg-content-safe-area-inset-right", 8],
    ])
  })

  it("does not expose a viewport width variable", () => {
    expect(viewportCssVariables(createState()).map(([name]) => name)).not.toContain(
      "--tg-viewport-width",
    )
  })
})

describe("bindViewportCssVariables", () => {
  it("writes the current state on binding and on updates", () => {
    const store = createStore<ViewportState>(createState())
    const { properties, target } = createTarget()

    const unbind = bindViewportCssVariables(store, target)
    expect(properties.get("--tg-viewport-height")).toBe("640px")
    expect(properties.get("--tg-safe-area-inset-top")).toBe("1px")

    store.update({ height: 200 })
    expect(properties.get("--tg-viewport-height")).toBe("200px")

    unbind()
  })

  it("unsubscribes and removes the properties on unbinding", () => {
    const store = createStore<ViewportState>(createState())
    const { properties, target } = createTarget()
    const unbind = bindViewportCssVariables(store, target)
    expect(properties.size).toBe(10)

    unbind()
    expect(properties.size).toBe(0)

    store.update({ height: 200 })
    expect(properties.size).toBe(0)
  })
})
