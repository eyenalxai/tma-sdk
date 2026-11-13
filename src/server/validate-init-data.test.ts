import { describe, expect, it } from "bun:test"

import { isInitDataValid, validateInitData, validateInitDataSignature } from "./validate-init-data"

const BOT_TOKEN = "test-bot-token"
const AUTH_DATE = "1700000000"

const TELEGRAM_BOT_ID = 7_342_037_359
const TELEGRAM_PRODUCTION_PUBLIC_KEY =
  "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d"
const TELEGRAM_TEST_PUBLIC_KEY = "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec"

// Sample init data from the Telegram Mini Apps documentation.
// The signature is a real Ed25519 signature from the production environment.
const TELEGRAM_INIT_DATA =
  "user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D" +
  "&chat_instance=8134722200314281151" +
  "&chat_type=private" +
  "&auth_date=1733584787" +
  "&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ" +
  "&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6"

// The same fields plus a chat join request query id, re-signed with BOT_TOKEN.
// This uses the HMAC input that includes the signature field.
const HMAC_INIT_DATA_WITH_SIGNATURE =
  "user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav+%2B+-+%3F+%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D" +
  "&chat_instance=8134722200314281151" +
  "&chat_type=private" +
  "&auth_date=1733584787" +
  "&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ" +
  "&chat_join_request_query_id=AAHdF6IQAAAAAN0XohDhrOrc" +
  "&hash=8da8673af16288204fe591aac493044148193b0d8bd67b267028329ec09409d7"

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

  it("keeps the signature field in the HMAC input", () => {
    const initData = validateInitData(HMAC_INIT_DATA_WITH_SIGNATURE, BOT_TOKEN, { expiresIn: 0 })

    expect(initData.user?.id).toBe(279_058_397)
    expect(initData.chat_join_request_query_id).toBe("AAHdF6IQAAAAAN0XohDhrOrc")

    const withoutSignature = new URLSearchParams(HMAC_INIT_DATA_WITH_SIGNATURE)
    withoutSignature.delete("signature")
    expect(isInitDataValid(withoutSignature, BOT_TOKEN, { expiresIn: 0 })).toBe(false)

    const changedSignature = HMAC_INIT_DATA_WITH_SIGNATURE.replace(
      "zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ",
      "zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADA",
    )
    expect(isInitDataValid(changedSignature, BOT_TOKEN, { expiresIn: 0 })).toBe(false)
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

describe("validateInitDataSignature", () => {
  it("accepts init data signed by Telegram", () => {
    const initData = validateInitDataSignature(TELEGRAM_INIT_DATA, {
      botId: TELEGRAM_BOT_ID,
      publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
      expiresIn: 0,
    })

    expect(initData.user?.id).toBe(279_058_397)
    expect(initData.auth_date).toEqual(new Date(1_733_584_787 * 1000))
  })

  it("accepts URLSearchParams input", () => {
    const params = new URLSearchParams(TELEGRAM_INIT_DATA)
    const initData = validateInitDataSignature(params, {
      botId: TELEGRAM_BOT_ID,
      publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
      expiresIn: 0,
    })

    expect(initData.user?.id).toBe(279_058_397)
  })

  it("rejects tampered init data", () => {
    const tampered = TELEGRAM_INIT_DATA.replace("%22id%22%3A279058397", "%22id%22%3A279058398")

    expect(() => {
      validateInitDataSignature(tampered, {
        botId: TELEGRAM_BOT_ID,
        publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data signature is invalid")
  })

  it("rejects expired init data", () => {
    expect(() => {
      validateInitDataSignature(TELEGRAM_INIT_DATA, {
        botId: TELEGRAM_BOT_ID,
        publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
        expiresIn: 1,
      })
    }).toThrow("Init data has expired")
  })

  it("rejects init data signed for another environment", () => {
    expect(() => {
      validateInitDataSignature(TELEGRAM_INIT_DATA, {
        botId: TELEGRAM_BOT_ID,
        publicKey: TELEGRAM_TEST_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data signature is invalid")
  })

  it("rejects malformed signatures", () => {
    const params = new URLSearchParams(TELEGRAM_INIT_DATA)
    params.set("signature", "not-a-signature")

    expect(() => {
      validateInitDataSignature(params, {
        botId: TELEGRAM_BOT_ID,
        publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data has an invalid signature")
  })

  it("rejects invalid public keys", () => {
    expect(() => {
      validateInitDataSignature(TELEGRAM_INIT_DATA, {
        botId: TELEGRAM_BOT_ID,
        publicKey: "not-a-public-key",
      })
    }).toThrow("publicKey must be a 32-byte hex string")
  })

  it("rejects invalid bot ids", () => {
    expect(() => {
      validateInitDataSignature(TELEGRAM_INIT_DATA, {
        botId: 0,
        publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
      })
    }).toThrow("botId must be a positive safe integer")
  })

  it("rejects init data without a signature", () => {
    const params = new URLSearchParams(TELEGRAM_INIT_DATA)
    params.delete("signature")

    expect(() => {
      validateInitDataSignature(params, {
        botId: TELEGRAM_BOT_ID,
        publicKey: TELEGRAM_PRODUCTION_PUBLIC_KEY,
      })
    }).toThrow("Init data is missing the signature")
  })
})
