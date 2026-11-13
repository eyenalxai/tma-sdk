import type { ReadonlyStore } from "#lib/store"

/**
 * The uniform shape of every feature controller.
 *
 * `supported` tells the caller whether the controller's methods are available
 * in the current Telegram client. Check it before calling `actions`: a
 * controller whose methods are unavailable either no-ops or throws, depending
 * on the feature, so the caller must decide how to proceed. `state` is a
 * read-only store, and `actions` holds the user-facing calls.
 */
type FeatureController<State, Actions> = {
  supported: boolean
  state: ReadonlyStore<State>
  actions: Actions
}

export type { FeatureController }
