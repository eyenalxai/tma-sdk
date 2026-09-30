import { describe, expect, it } from "bun:test"

import { createDisposer } from "./disposer"

describe("createDisposer", () => {
  it("runs cleanups in reverse registration order", () => {
    const calls: string[] = []
    const disposer = createDisposer()
    disposer.add(() => {
      calls.push("first")
    })
    disposer.add(() => {
      calls.push("second")
    })
    disposer.add(() => {
      calls.push("third")
    })

    disposer.dispose()

    expect(calls).toEqual(["third", "second", "first"])
  })

  it("reports its disposal state", () => {
    const disposer = createDisposer()

    expect(disposer.isDisposed).toBe(false)
    disposer.dispose()
    expect(disposer.isDisposed).toBe(true)
  })

  it("disposes at most once", () => {
    let calls = 0
    const disposer = createDisposer()
    disposer.add(() => {
      calls += 1
    })

    disposer.dispose()
    disposer.dispose()

    expect(calls).toBe(1)
  })

  it("rejects cleanups added after disposal", () => {
    let calls = 0
    const disposer = createDisposer()
    disposer.dispose()

    expect(() => {
      disposer.add(() => {
        calls += 1
      })
    }).toThrow("Cannot add a cleanup to a disposed disposer")
    expect(calls).toBe(0)
  })

  it("runs the remaining cleanups when one fails", () => {
    const calls: string[] = []
    const failure = new Error("cleanup failed")
    const disposer = createDisposer()
    disposer.add(() => {
      calls.push("first")
    })
    disposer.add(() => {
      throw failure
    })
    disposer.add(() => {
      calls.push("last")
    })

    let caught: unknown = null
    try {
      disposer.dispose()
    } catch (error) {
      caught = error
    }

    expect(calls).toEqual(["last", "first"])
    expect(caught).toBeInstanceOf(AggregateError)
    expect(caught instanceof AggregateError ? caught.errors : null).toEqual([failure])
  })
})
