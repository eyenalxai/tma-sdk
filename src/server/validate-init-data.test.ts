import { describe, expect, it } from "bun:test"
import { createHmac, generateKeyPairSync, sign } from "node:crypto"

import { isInitDataValid, validateInitData, validateInitDataSignature } from "./validate-init-data"

const BOT_TOKEN = "test-bot-token"
const AUTH_DATE = "1700000000"
const BOT_ID = 123_456_789

const SYNTHETIC_USER = JSON.stringify({
  id: 42,
  first_name: "Test",
  last_name: "User",
  username: "test_user",
  language_code: "en",
  is_premium: true,
})

const baseParams = (): URLSearchParams =>
  new URLSearchParams({
    auth_date: AUTH_DATE,
    chat_instance: "test-chat-instance",
    chat_type: "private",
    user: SYNTHETIC_USER,
  })

const hmacHash = (params: URLSearchParams): string => {
  const pairs = [...params.entries()].map(([key, value]) => `${key}=${value}`).toSorted()
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest()
  return createHmac("sha256", secretKey).update(pairs.join("\n")).digest("hex")
}

const VALID_INIT_DATA = (() => {
  const params = baseParams()
  params.set("hash", hmacHash(params))
  return params.toString()
})()

// The HMAC input includes the signature field.
// Changing or removing the field must invalidate the hash.
const HMAC_INIT_DATA_WITH_SIGNATURE = (() => {
  const params = baseParams()
  params.set("signature", "test-signature")
  params.set("chat_join_request_query_id", "test-join-request")
  params.set("hash", hmacHash(params))
  return params.toString()
})()

const createTestKeyPair = () =>
  // oxlint-disable-next-line node/no-sync -- test fixture generated once at module load
  generateKeyPairSync("ed25519")

const { publicKey: ed25519PublicKey, privateKey: ed25519PrivateKey } = createTestKeyPair()
const ED25519_PUBLIC_KEY = Buffer.from(ed25519PublicKey.export({ format: "der", type: "spki" }))
  .subarray(-32)
  .toString("hex")

const { publicKey: otherPublicKey } = createTestKeyPair()
const OTHER_ED25519_PUBLIC_KEY = Buffer.from(otherPublicKey.export({ format: "der", type: "spki" }))
  .subarray(-32)
  .toString("hex")

// Synthetic Ed25519 fixture.
// The signature covers every field except hash and signature, prefixed with the bot id.
const SIGNATURE_INIT_DATA = (() => {
  const params = baseParams()
  params.set("chat_join_request_query_id", "test-join-request")
  const dataCheckString = `${BOT_ID}:WebAppData\n${[...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .toSorted()
    .join("\n")}`
  const signature = sign(null, Buffer.from(dataCheckString, "utf8"), ed25519PrivateKey).toString(
    "base64url",
  )
  params.set("signature", signature)
  // The verifier requires a hash-shaped field; it does not verify it.
  params.set("hash", "a".repeat(64))
  return params.toString()
})()

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

    expect(initData.user?.id).toBe(42)
    expect(initData.chat_join_request_query_id).toBe("test-join-request")

    const withoutSignature = new URLSearchParams(HMAC_INIT_DATA_WITH_SIGNATURE)
    withoutSignature.delete("signature")
    expect(isInitDataValid(withoutSignature, BOT_TOKEN, { expiresIn: 0 })).toBe(false)

    const changedSignature = new URLSearchParams(HMAC_INIT_DATA_WITH_SIGNATURE)
    changedSignature.set("signature", "different-signature")
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
  it("accepts init data signed with the test key", () => {
    const initData = validateInitDataSignature(SIGNATURE_INIT_DATA, {
      botId: BOT_ID,
      publicKey: ED25519_PUBLIC_KEY,
      expiresIn: 0,
    })

    expect(initData.user?.id).toBe(42)
    expect(initData.chat_join_request_query_id).toBe("test-join-request")
    expect(initData.auth_date).toEqual(new Date(1_700_000_000 * 1000))
  })

  it("accepts URLSearchParams input", () => {
    const params = new URLSearchParams(SIGNATURE_INIT_DATA)
    const initData = validateInitDataSignature(params, {
      botId: BOT_ID,
      publicKey: ED25519_PUBLIC_KEY,
      expiresIn: 0,
    })

    expect(initData.user?.id).toBe(42)
  })

  it("rejects tampered init data", () => {
    const tampered = SIGNATURE_INIT_DATA.replace("%22id%22%3A42", "%22id%22%3A43")

    expect(() => {
      validateInitDataSignature(tampered, {
        botId: BOT_ID,
        publicKey: ED25519_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data signature is invalid")
  })

  it("rejects expired init data", () => {
    expect(() => {
      validateInitDataSignature(SIGNATURE_INIT_DATA, {
        botId: BOT_ID,
        publicKey: ED25519_PUBLIC_KEY,
        expiresIn: 1,
      })
    }).toThrow("Init data has expired")
  })

  it("rejects init data signed for another key", () => {
    expect(() => {
      validateInitDataSignature(SIGNATURE_INIT_DATA, {
        botId: BOT_ID,
        publicKey: OTHER_ED25519_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data signature is invalid")
  })

  it("rejects malformed signatures", () => {
    const params = new URLSearchParams(SIGNATURE_INIT_DATA)
    params.set("signature", "not-a-signature")

    expect(() => {
      validateInitDataSignature(params, {
        botId: BOT_ID,
        publicKey: ED25519_PUBLIC_KEY,
        expiresIn: 0,
      })
    }).toThrow("Init data has an invalid signature")
  })

  it("rejects invalid public keys", () => {
    expect(() => {
      validateInitDataSignature(SIGNATURE_INIT_DATA, {
        botId: BOT_ID,
        publicKey: "not-a-public-key",
      })
    }).toThrow("publicKey must be a 32-byte hex string")
  })

  it("rejects invalid bot ids", () => {
    expect(() => {
      validateInitDataSignature(SIGNATURE_INIT_DATA, {
        botId: 0,
        publicKey: ED25519_PUBLIC_KEY,
      })
    }).toThrow("botId must be a positive safe integer")
  })

  it("rejects init data without a signature", () => {
    const params = new URLSearchParams(SIGNATURE_INIT_DATA)
    params.delete("signature")

    expect(() => {
      validateInitDataSignature(params, {
        botId: BOT_ID,
        publicKey: ED25519_PUBLIC_KEY,
      })
    }).toThrow("Init data is missing the signature")
  })
})
