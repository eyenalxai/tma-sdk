import { createHmac, timingSafeEqual } from "node:crypto"

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
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 0) {
    throw new Error("expiresIn must be a non-negative safe integer")
  }

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
  if (authDateMilliseconds === undefined) {
    throw new Error("Init data has an invalid auth_date")
  }
  if (!/^[\da-f]{64}$/u.test(hash)) {
    throw new Error("Init data has an invalid hash")
  }

  if (expiresIn > 0 && authDateMilliseconds + expiresIn * 1000 < Date.now()) {
    throw new Error("Init data has expired")
  }

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

export { isInitDataValid, validateInitData, type ValidateInitDataOptions }
