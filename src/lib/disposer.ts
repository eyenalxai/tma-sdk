type Disposer = {
  add: (cleanup: () => void) => void
  dispose: () => void
  readonly isDisposed: boolean
}

const createDisposer = (): Disposer => {
  const cleanups: (() => void)[] = []
  let isDisposed = false

  return {
    add: (cleanup) => {
      if (isDisposed) {
        throw new Error("Cannot add a cleanup to a disposed disposer")
      }
      cleanups.push(cleanup)
    },
    dispose: () => {
      if (isDisposed) {
        return
      }
      isDisposed = true

      const errors: unknown[] = []
      for (const cleanup of cleanups.splice(0).toReversed()) {
        try {
          cleanup()
        } catch (error) {
          errors.push(error)
        }
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, "Cleanup failed")
      }
    },
    get isDisposed() {
      return isDisposed
    },
  }
}

export { createDisposer, type Disposer }
