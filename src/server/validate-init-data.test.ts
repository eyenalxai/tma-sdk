import { describe, expect, it } from "bun:test"

import { isInitDataValid, validateInitData } from "./validate-init-data"

const BOT_TOKEN = "test-bot-token"
const AUTH_DATE = "1700000000"

const VALID_INIT_DATA = new URLSearchParams({
  auth_date: AUTH_DATE,
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
  hash: "f7bb61adab3b067a0bc27caa9d65b6c5b83b284676b73087692eea71ffe84e04",
}).toString()

describe("validateInitData", () => {
  it("accepts correctly signed init data", () => {
    const initData = validateInitData(VALID_INIT_DATA, BOT_TOKEN, { expiresIn: 0 })

    expect(initData.user?.id).toBe(42)
    expect(initData.auth_date).toEqual(new Date(1_700_000_000 * 1000))
  })

  it("accepts URLSearchParams input", () => {
    const params = new URLSearchParams(VALID_INIT_DATA)
    expect(() => {
      validateInitData(params, BOT_TOKEN, { expiresIn: 0 })
    }).not.toThrow()
  })

  it("rejects init data signed with a different token", () => {
    expect(isInitDataValid(VALID_INIT_DATA, "123:wrong-token", { expiresIn: 0 })).toBe(false)
  })

  it("rejects tampered init data", () => {
    const tampered = VALID_INIT_DATA.replace("Test", "Tampered")
    expect(isInitDataValid(tampered, BOT_TOKEN, { expiresIn: 0 })).toBe(false)
  })

  it("rejects init data without a hash", () => {
    const withoutHash = VALID_INIT_DATA.replace(/&hash=.*$/u, "")
    expect(() => {
      validateInitData(withoutHash, BOT_TOKEN, { expiresIn: 0 })
    }).toThrow("Init data is missing the hash")
  })

  it("rejects expired init data", () => {
    expect(isInitDataValid(VALID_INIT_DATA, BOT_TOKEN, { expiresIn: 1 })).toBe(false)
  })

  it("rejects malformed hashes", () => {
    const malformed = VALID_INIT_DATA.replace(/hash=[\da-f]+$/u, "hash=not-a-sha256-hash")
    expect(() => {
      validateInitData(malformed, BOT_TOKEN, { expiresIn: 0 })
    }).toThrow("Init data has an invalid hash")
  })

  it("rejects invalid auth dates", () => {
    const malformed = VALID_INIT_DATA.replace(`auth_date=${AUTH_DATE}`, "auth_date=1.5")
    expect(() => {
      validateInitData(malformed, BOT_TOKEN, { expiresIn: 0 })
    }).toThrow("Init data has an invalid auth_date")
  })

  it("rejects invalid expiration options", () => {
    expect(() => {
      validateInitData(VALID_INIT_DATA, BOT_TOKEN, { expiresIn: -1 })
    }).toThrow("expiresIn must be a non-negative safe integer")
  })

  it("rejects duplicate security fields", () => {
    expect(() => {
      validateInitData(`${VALID_INIT_DATA}&hash=${"a".repeat(64)}`, BOT_TOKEN, { expiresIn: 0 })
    }).toThrow("Init data contains multiple hashes")
    expect(() => {
      validateInitData(`${VALID_INIT_DATA}&auth_date=${AUTH_DATE}`, BOT_TOKEN, { expiresIn: 0 })
    }).toThrow("Init data contains multiple auth_date values")
  })
})
