import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto"

import type { InitData } from "#lib/init-data"

import { parseInitData } from "#lib/init-data"

type ValidateInitDataOptions = {
  /**
   * Time in seconds during which init data is considered valid since its
   * creation. When 0, expiration is not checked.
   * @default 86400 (1 day)
   */
  expiresIn?: number
}

type ValidateInitDataSignatureOptions = {
  /**
   * Identifier of the bot the init data was issued for.
   */
  botId: number
  /**
   * Telegram's raw 32-byte Ed25519 public key as a hex string. Use the
   * production key for production init data and the test key for test data.
   */
  publicKey: string
  /**
   * Time in seconds during which init data is considered valid since its
   * creation. When 0, expiration is not checked.
   * @default 86400 (1 day)
   */
  expiresIn?: number
}

const ED25519_SPKI_PREFIX = "302a300506032b6570032100"

const parseAuthDateMilliseconds = (value: string): number | undefined => {
  if (!/^\d+$/u.test(value)) {
    return undefined
  }
  const timestamp = Number(value)
  const milliseconds = timestamp * 1000
  return Number.isSafeInteger(timestamp) && !Number.isNaN(new Date(milliseconds).getTime())
    ? milliseconds
    : undefined
}

const assertExpiresIn = (expiresIn: number): void => {
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 0) {
    throw new Error("expiresIn must be a non-negative safe integer")
  }
}

const assertAuthDateFresh = (authDateMilliseconds: number | undefined, expiresIn: number): void => {
  if (authDateMilliseconds === undefined) {
    throw new Error("Init data has an invalid auth_date")
  }
  if (expiresIn > 0 && authDateMilliseconds + expiresIn * 1000 < Date.now()) {
    throw new Error("Init data has expired")
  }
}

/**
 * Validates Telegram Mini App init data using the bot token.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @throws If init data is missing the hash, has an invalid auth date, is expired,
 * or has an invalid signature.
 */
const validateInitData = (
  value: string | URLSearchParams,
  token: string,
  options: ValidateInitDataOptions = {},
): InitData => {
  const { expiresIn = 86_400 } = options
  assertExpiresIn(expiresIn)

  let authDateMilliseconds: number | undefined = undefined
  let hash: string | undefined = undefined
  const pairs: string[] = []

  const params = typeof value === "string" ? new URLSearchParams(value) : value
  for (const [key, paramValue] of params) {
    if (key === "hash") {
      if (hash !== undefined) {
        throw new Error("Init data contains multiple hashes")
      }
      hash = paramValue
    } else {
      if (key === "auth_date") {
        if (authDateMilliseconds !== undefined) {
          throw new Error("Init data contains multiple auth_date values")
        }
        authDateMilliseconds = parseAuthDateMilliseconds(paramValue)
      }
      pairs.push(`${key}=${paramValue}`)
    }
  }

  if (hash === undefined) {
    throw new Error("Init data is missing the hash")
  }
  assertAuthDateFresh(authDateMilliseconds, expiresIn)
  if (!/^[\da-f]{64}$/u.test(hash)) {
    throw new Error("Init data has an invalid hash")
  }

  // The HMAC covers every received field except hash.
  // The signature field stays in the input; only the Ed25519 check excludes it.
  pairs.sort()
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest()
  const signature = createHmac("sha256", secretKey).update(pairs.join("\n")).digest()
  const expectedSignature = Buffer.from(hash, "hex")

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Init data signature is invalid")
  }

  return parseInitData(params)
}

const isInitDataValid = (
  value: string | URLSearchParams,
  token: string,
  options: ValidateInitDataOptions = {},
): boolean => {
  try {
    validateInitData(value, token, options)
    return true
  } catch {
    return false
  }
}

/**
 * Validates Telegram Mini App init data using Telegram's Ed25519 public key.
 * Use this check when a third party receives init data without the bot token.
 * @see https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
 * @throws If init data is missing the hash or signature, has an invalid auth
 * date, is expired, or has an invalid signature.
 */
const validateInitDataSignature = (
  value: string | URLSearchParams,
  options: ValidateInitDataSignatureOptions,
): InitData => {
  const { botId, publicKey, expiresIn = 86_400 } = options
  assertExpiresIn(expiresIn)
  if (!Number.isSafeInteger(botId) || botId <= 0) {
    throw new Error("botId must be a positive safe integer")
  }
  if (!/^[\da-f]{64}$/u.test(publicKey)) {
    throw new Error("publicKey must be a 32-byte hex string")
  }

  let authDateMilliseconds: number | undefined = undefined
  let hash: string | undefined = undefined
  let signature: string | undefined = undefined
  const pairs: string[] = []

  const params = typeof value === "string" ? new URLSearchParams(value) : value
  for (const [key, paramValue] of params) {
    if (key === "hash") {
      if (hash !== undefined) {
        throw new Error("Init data contains multiple hashes")
      }
      hash = paramValue
    } else if (key === "signature") {
      if (signature !== undefined) {
        throw new Error("Init data contains multiple signatures")
      }
      signature = paramValue
    } else {
      if (key === "auth_date") {
        if (authDateMilliseconds !== undefined) {
          throw new Error("Init data contains multiple auth_date values")
        }
        authDateMilliseconds = parseAuthDateMilliseconds(paramValue)
      }
      pairs.push(`${key}=${paramValue}`)
    }
  }

  if (hash === undefined) {
    throw new Error("Init data is missing the hash")
  }
  if (signature === undefined) {
    throw new Error("Init data is missing the signature")
  }
  assertAuthDateFresh(authDateMilliseconds, expiresIn)
  if (!/^[\da-f]{64}$/u.test(hash)) {
    throw new Error("Init data has an invalid hash")
  }

  const signatureBytes = Buffer.from(signature, "base64url")
  if (signatureBytes.length !== 64) {
    throw new Error("Init data has an invalid signature")
  }

  // The Ed25519 input excludes hash and signature.
  // It is prefixed with the bot id, unlike the bot-token HMAC input.
  pairs.sort()
  const dataCheckString = `${botId}:WebAppData\n${pairs.join("\n")}`
  const key = createPublicKey({
    key: Buffer.concat([Buffer.from(ED25519_SPKI_PREFIX, "hex"), Buffer.from(publicKey, "hex")]),
    format: "der",
    type: "spki",
  })

  if (!verify(null, Buffer.from(dataCheckString, "utf8"), key, signatureBytes)) {
    throw new Error("Init data signature is invalid")
  }

  return parseInitData(params)
}

export {
  isInitDataValid,
  validateInitData,
  validateInitDataSignature,
  type ValidateInitDataOptions,
  type ValidateInitDataSignatureOptions,
}
