import { describe, expect, it } from "vitest"

import { parseInitData } from "./init-data"
import { parseLaunchParams } from "./launch-params"

describe("parseInitData", () => {
  it("parses a full init data query string", () => {
    const initData = parseInitData(
      new URLSearchParams({
        auth_date: "1700000000",
        chat_instance: "test-chat-instance",
        chat_type: "private",
        user: JSON.stringify({
          id: 42,
          first_name: "Test",
          last_name: "User",
          username: "test_user",
          language_code: "en",
          is_premium: true,
        }),
        hash: "a".repeat(64),
        start_param: "crm-user-1",
      }),
    )

    expect(initData.hash).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(initData.auth_date).toEqual(new Date(1_700_000_000 * 1000))
    expect(initData.chat_type).toBe("private")
    expect(initData.start_param).toBe("crm-user-1")
    expect(initData.user).toEqual({
      id: 42,
      first_name: "Test",
      last_name: "User",
      username: "test_user",
      language_code: "en",
      is_premium: true,
    })
  })

  it("throws when the hash is missing", () => {
    expect(() => parseInitData("auth_date=1662771648")).toThrow()
  })

  it("rejects malformed numeric values", () => {
    expect(() =>
      parseInitData(
        "auth_date=invalid&hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toThrow()
    expect(() =>
      parseInitData(
        "auth_date=1662771648&can_send_after=1.5&hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toThrow()
  })
})

describe("parseLaunchParams", () => {
  it("parses launch params from a query string", () => {
    const launchParams = parseLaunchParams(
      "tgWebAppVersion=8.0&tgWebAppPlatform=ios&tgWebAppData=user%3D%257B%2522id%2522%253A1%257D%26auth_date%3D1662771648%26hash%3Daaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&tgWebAppStartParam=event-123&tgWebAppFullscreen=1&tgWebAppBotInline=0",
    )

    expect(launchParams.tgWebAppVersion).toBe("8.0")
    expect(launchParams.tgWebAppPlatform).toBe("ios")
    expect(launchParams.tgWebAppStartParam).toBe("event-123")
    expect(launchParams.tgWebAppFullscreen).toBe(true)
    expect(launchParams.tgWebAppBotInline).toBe(false)
    expect(launchParams.tgWebAppData).toBe(
      "user=%7B%22id%22%3A1%7D&auth_date=1662771648&hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
  })

  it("throws when required fields are missing", () => {
    expect(() => parseLaunchParams("tgWebAppPlatform=ios")).toThrow()
  })

  it("rejects malformed booleans and versions", () => {
    expect(() =>
      parseLaunchParams("tgWebAppVersion=8.0&tgWebAppPlatform=ios&tgWebAppFullscreen=true"),
    ).toThrow()
    expect(() => parseLaunchParams("tgWebAppVersion=latest&tgWebAppPlatform=ios")).toThrow()
  })

  it("does not expose unrelated URL parameters", () => {
    expect(
      parseLaunchParams("tgWebAppVersion=8.0&tgWebAppPlatform=ios&inviteToken=secret"),
    ).toEqual({
      tgWebAppVersion: "8.0",
      tgWebAppPlatform: "ios",
    })
  })
})
