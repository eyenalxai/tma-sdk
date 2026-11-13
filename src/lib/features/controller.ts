import type { ReadonlyStore } from "#lib/store"

/**
 * The uniform shape of every feature controller. `supported` is the protocol's
 * answer for the controller's methods, `state` is read-only and `actions`
 * holds the user-facing calls.
 */
type FeatureController<State, Actions> = {
  supported: boolean
  state: ReadonlyStore<State>
  actions: Actions
}

export type { FeatureController }
