import { describe, expect, it } from "bun:test"

import { createTestRuntime } from "#lib/protocol/test-support"

import { createMiniApp } from "./mini-app"

describe("createMiniApp", () => {
  it("omits an RGB header color below 6.9", () => {
    const environment = createTestRuntime("ios", "6.8")
    try {
      createMiniApp(environment.runtime).setHeaderColor("#ffffff")

      expect(environment.posts).toEqual([])
    } finally {
      environment.dispose()
    }
  })

  it("sends an RGB header color from 6.9", () => {
    const environment = createTestRuntime("ios", "6.9")
    try {
      createMiniApp(environment.runtime).setHeaderColor("#ffffff")

      expect(environment.posts).toEqual([
        { eventType: "web_app_set_header_color", eventData: '{"color":"#ffffff"}' },
      ])
    } finally {
      environment.dispose()
    }
  })

  it("does not send ready where the client does not implement it", () => {
    for (const platform of ["tdesktop", "windows"]) {
      const environment = createTestRuntime(platform, "9.6")
      try {
        createMiniApp(environment.runtime).ready()

        expect(environment.posts).toEqual([])
      } finally {
        environment.dispose()
      }
    }
  })

  it("sends ready on a platform that implements it", () => {
    const environment = createTestRuntime("ios", "9.6")
    try {
      createMiniApp(environment.runtime).ready()

      expect(environment.posts).toEqual([{ eventType: "web_app_ready", eventData: '""' }])
    } finally {
      environment.dispose()
    }
  })
})
