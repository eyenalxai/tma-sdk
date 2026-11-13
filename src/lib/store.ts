type ReadonlyStore<T> = {
  get: () => T
  subscribe: (listener: () => void) => () => void
}

type Store<T extends object> = ReadonlyStore<T> & {
  set: (value: T) => void
  update: (partial: Partial<T>) => void
}

type ScalarStore<T> = ReadonlyStore<T> & {
  set: (value: T) => void
}

type StoreCore<T> = {
  readonly store: ReadonlyStore<T>
  set: (value: T) => void
}

const createStoreCore = <T>(initial: T): StoreCore<T> => {
  let value = initial
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    store: {
      get: () => value,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    set: (next) => {
      if (Object.is(value, next)) {
        return
      }
      value = next
      notify()
    },
  }
}

const createStore = <T extends object>(initial: T): Store<T> => {
  const { store, set } = createStoreCore(initial)

  return {
    ...store,
    set,
    update: (partial) => {
      const current = store.get()
      let hasChanges = false
      for (const key in partial) {
        if (Object.hasOwn(partial, key) && !Object.is(current[key], partial[key])) {
          hasChanges = true
          break
        }
      }
      if (!hasChanges) {
        return
      }
      set({ ...current, ...partial })
    },
  }
}

const createScalarStore = <T>(initial: T): ScalarStore<T> => {
  const { store, set } = createStoreCore(initial)
  return { ...store, set }
}

const noopSubscribe = (): (() => void) => () => undefined

/** A store whose value never changes, for stateless controllers. */
const createConstantStore = <T>(value: T): ReadonlyStore<T> => {
  return {
    get: () => value,
    subscribe: noopSubscribe,
  }
}

export {
  createConstantStore,
  createScalarStore,
  createStore,
  type ReadonlyStore,
  type ScalarStore,
  type Store,
}
