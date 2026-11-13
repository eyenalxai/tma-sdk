import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import {
  compareVersions,
  eventTable,
  isEventName,
  isMethodName,
  methodTable,
  normalizePlatform,
  supports,
  supportsParam,
} from "./methods"

const readVendoredScript = async (): Promise<string> => {
  const url = new URL("../../../docs/research/vendor/telegram-web-app.js", import.meta.url)
  return readFile(fileURLToPath(url), "utf8")
}

// Telegram Web's getUserMedia shim owns these names; they are not public.
const INTERNAL_SCRIPT_METHODS = new Set([
  "web_app_check_media_access",
  "web_app_request_media_access",
])
const INTERNAL_SCRIPT_EVENTS = new Set([
  "media_access_changed",
  "media_access_checked",
  "media_access_requested",
])

// Native clients handle this method, but the official Web script never emits it.
const SCRIPT_ABSENT_METHODS = new Set(["web_app_verify_age"])
// Native clients can fail the home-screen request; the Web script has no handler.
const SCRIPT_ABSENT_EVENTS = new Set(["home_screen_failed"])

// These are registered without an onEvent('<literal>') call.
const NON_ON_EVENT_REGISTRATIONS = [
  // Registered through a variable in the bottom-button constructor.
  "main_button_pressed",
  "secondary_button_pressed",
  // Handled by the iframe listener rather than onEvent.
  "reload_iframe",
  "set_custom_style",
] as const

const scriptMethods = (script: string): string[] => [
  ...new Set(
    [...script.matchAll(/'(?<method>(?:web_app|iframe)_[a-z0-9_]+)'/gu)].map(
      (match) => match.groups?.method ?? "",
    ),
  ),
]

const scriptEvents = (script: string): string[] => [
  ...new Set([
    ...[...script.matchAll(/onEvent\('(?<event>[a-z0-9_]+)'/gu)].map(
      (match) => match.groups?.event ?? "",
    ),
    ...NON_ON_EVENT_REGISTRATIONS,
  ]),
]

const publicScriptMethods = (script: string): string[] =>
  scriptMethods(script).filter((method) => !INTERNAL_SCRIPT_METHODS.has(method))

const publicScriptEvents = (script: string): string[] =>
  scriptEvents(script).filter((event) => !INTERNAL_SCRIPT_EVENTS.has(event))

describe("method table", () => {
  it("covers every public method and event in the vendored official script", async () => {
    const script = await readVendoredScript()
    const methods = publicScriptMethods(script)
    const events = publicScriptEvents(script)

    expect(methods.length).toBeGreaterThan(50)
    expect(events.length).toBeGreaterThan(50)
    expect(methods.filter((method) => !isMethodName(method))).toEqual([])
    expect(events.filter((event) => !isEventName(event))).toEqual([])
  })

  it("has no table entry the vendored official script does not expose", async () => {
    const script = await readVendoredScript()
    const methods = new Set(scriptMethods(script))
    const events = new Set(scriptEvents(script))

    const tableMethods = Object.keys(methodTable).filter(
      (method) => !SCRIPT_ABSENT_METHODS.has(method),
    )
    expect(tableMethods.filter((method) => !methods.has(method))).toEqual([])
    const tableEvents = Object.keys(eventTable).filter((event) => !SCRIPT_ABSENT_EVENTS.has(event))
    expect(tableEvents.filter((event) => !events.has(event))).toEqual([])
    for (const method of SCRIPT_ABSENT_METHODS) {
      expect(methods).not.toContain(method)
    }
    for (const event of SCRIPT_ABSENT_EVENTS) {
      expect(events).not.toContain(event)
    }
  })

  it("keeps the internal Web media shims out of the public table", async () => {
    const script = await readVendoredScript()
    const methods = scriptMethods(script)
    const events = scriptEvents(script)

    for (const method of INTERNAL_SCRIPT_METHODS) {
      expect(methods).toContain(method)
      expect(isMethodName(method)).toBe(false)
    }
    for (const event of INTERNAL_SCRIPT_EVENTS) {
      expect(events).toContain(event)
      expect(isEventName(event)).toBe(false)
    }
  })

  it("gives every method an introduced version and a response-event list", () => {
    for (const [method, definition] of Object.entries(methodTable)) {
      expect(method).toMatch(/^(?:web_app|iframe)_[a-z0-9_]+$/u)
      expect(definition.since).toMatch(/^\d+\.\d+$/u)
      expect(Array.isArray(definition.events)).toBe(true)
      if ("paramVersions" in definition) {
        for (const since of Object.values(definition.paramVersions)) {
          expect(since).toMatch(/^\d+\.\d+$/u)
        }
      }
    }
  })

  it("marks only the raw-payload method", () => {
    const rawMethods = Object.entries(methodTable)
      .filter(([, definition]) => "raw" in definition && definition.raw)
      .map(([method]) => method)

    expect(rawMethods).toEqual(["web_app_data_send"])
  })

  it("registers every event with a payload schema", () => {
    for (const [event, definition] of Object.entries(eventTable)) {
      expect(event).toMatch(/^[a-z0-9_]+$/u)
      expect(definition.schema).toBeDefined()
      expect(definition.since).toMatch(/^\d+\.\d+$/u)
    }
  })
})

describe("compareVersions", () => {
  it("compares versions segment by segment", () => {
    expect(compareVersions("8.0", "7.10")).toBeGreaterThan(0)
    expect(compareVersions("7.10", "8.0")).toBeLessThan(0)
    expect(compareVersions("8", "8.0.0")).toBe(0)
  })
})

describe("normalizePlatform", () => {
  it("keeps the observed platform values", () => {
    expect(normalizePlatform("ios")).toBe("ios")
    expect(normalizePlatform("webk")).toBe("webk")
    expect(normalizePlatform("tdesktop")).toBe("tdesktop")
  })

  it("maps unknown values to unknown", () => {
    expect(normalizePlatform("android_x")).toBe("unknown")
    expect(normalizePlatform("")).toBe("unknown")
  })
})

describe("supports", () => {
  it("reports supported when the version has the method and the platform has no contradiction", () => {
    expect(supports("web_app_request_fullscreen", "ios", "8.0")).toBe("supported")
    expect(supports("web_app_request_viewport", "ios", "6.0")).toBe("supported")
  })

  it("reports unsupported when the client source proves the method is absent", () => {
    expect(supports("web_app_trigger_haptic_feedback", "macos", "9.6")).toBe("unsupported")
    expect(supports("web_app_request_viewport", "webk", "9.0")).toBe("unsupported")
    expect(supports("iframe_ready", "ios", "9.6")).toBe("unsupported")
  })

  it("reports unknown when the declared version predates the method", () => {
    expect(supports("web_app_request_fullscreen", "ios", "7.10")).toBe("unknown")
    expect(supports("web_app_request_chat", "android", "9.5")).toBe("unknown")
  })

  it("reports unknown for an unknown platform", () => {
    expect(supports("web_app_ready", "unknown", "9.6")).toBe("unknown")
    expect(supports("web_app_ready", "android_x", "9.6")).toBe("unknown")
  })
})

describe("supportsParam", () => {
  it("gates parameters that appeared after their method", () => {
    expect(supportsParam("web_app_open_link", "try_instant_view", "6.3")).toBe(false)
    expect(supportsParam("web_app_open_link", "try_instant_view", "6.4")).toBe(true)
    expect(supportsParam("web_app_open_link", "try_browser", "7.5")).toBe(false)
    expect(supportsParam("web_app_open_link", "try_browser", "7.6")).toBe(true)
    expect(supportsParam("web_app_set_header_color", "color", "6.8")).toBe(false)
    expect(supportsParam("web_app_set_header_color", "color", "6.9")).toBe(true)
  })

  it("treats an unversioned parameter as available with the method", () => {
    expect(supportsParam("web_app_open_link", "url", "6.1")).toBe(true)
  })
})
