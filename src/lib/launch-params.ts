import { z } from "zod"

const optionalBooleanString = z
  .enum(["0", "1"])
  .transform((value) => value === "1")
  .optional()

const launchParamsSchema = z.object({
  tgWebAppBotInline: optionalBooleanString,
  tgWebAppData: z.string().optional(),
  tgWebAppFullscreen: optionalBooleanString,
  tgWebAppPlatform: z.string().min(1),
  tgWebAppShowSettings: optionalBooleanString,
  tgWebAppStartParam: z.string().optional(),
  tgWebAppVersion: z.string().regex(/^\d+(?:\.\d+)*$/u),
})

type LaunchParams = z.infer<typeof launchParamsSchema>

const SESSION_STORAGE_KEY = "@eyenalxai/tma-sdk/launch-params"

/**
 * Extracts the launch parameters query part from a URL: everything after the
 * first `?` or `#`, with subsequent separators normalized to `&`.
 */
const extractQueryFromUrl = (url: string): string =>
  url.replace(/^[^?#]*[?#]/u, "").replaceAll(/[?#]/gu, "&")

const parseLaunchParams = (query: string | URLSearchParams): LaunchParams => {
  const params = typeof query === "string" ? new URLSearchParams(query) : query
  return launchParamsSchema.parse(Object.fromEntries(params.entries()))
}

const readStoredLaunchParams = (): string | null => {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }
}

const storeLaunchParams = (params: URLSearchParams): void => {
  const storedParams = new URLSearchParams()
  for (const [key, value] of params) {
    if (Object.hasOwn(launchParamsSchema.shape, key)) {
      storedParams.append(key, value)
    }
  }

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, storedParams.toString())
  } catch {
    // Some embedded browsers disable storage; URL and navigation entries remain available.
  }
}

/**
 * Returns parsed launch parameters of the current Mini App session.
 * The validated Telegram parameters are persisted so client-side navigation can
 * change the URL without losing the original launch context.
 * @throws If launch parameters could not be found (not a Telegram environment).
 */
const retrieveLaunchParams = (): LaunchParams => {
  const candidates: string[] = [extractQueryFromUrl(window.location.href)]
  const navigationEntry = performance.getEntriesByType("navigation")[0]
  if (navigationEntry !== undefined) {
    candidates.push(extractQueryFromUrl(navigationEntry.name))
  }
  const storedLaunchParams = readStoredLaunchParams()
  if (storedLaunchParams !== null) {
    candidates.push(storedLaunchParams)
  }

  for (const candidate of candidates) {
    if (candidate === "") {
      continue
    }
    const params = new URLSearchParams(candidate)
    const result = launchParamsSchema.safeParse(Object.fromEntries(params.entries()))
    if (result.success) {
      storeLaunchParams(params)
      return result.data
    }
  }

  throw new Error(
    "Unable to retrieve Telegram launch parameters. The app was probably launched outside Telegram.",
  )
}

export { parseLaunchParams, retrieveLaunchParams, type LaunchParams }
