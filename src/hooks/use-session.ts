import { createContext, use } from "react"

import type { Session } from "#lib/session"

const SessionContext = createContext<Session | null>(null)

const useSession = (): Session => {
  const session = use(SessionContext)
  if (session === null) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return session
}

export { SessionContext, useSession }
