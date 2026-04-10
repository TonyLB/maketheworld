/**
 * Test-only helpers for deferring async completion (e.g. mock a long-running call,
 * assert intermediate effects, then unblock).
 *
 * Not exported from the package runtime entry. Import from
 * `@tonylb/mtw-lambda-patterns/ts/testing/asyncGate` in tests only.
 *
 * After `resolve()` or `reject()`, allow the event loop to run continuations before
 * asserting (e.g. `await Promise.resolve()`).
 */

export type AsyncGateControls<TArgs extends unknown[], TResult> = {
    /** One-shot: awaits `impl`, then blocks until `resolve` or `reject`. */
    fn: (...args: TArgs) => Promise<TResult>
    /** One-shot: unblocks the pending `fn`; throws if nothing is waiting. */
    resolve: () => void
    /** One-shot: rejects the pending `fn`; throws if nothing is waiting. */
    reject: (reason?: unknown) => void
}

/**
 * Wraps `impl` in an async function that runs `impl` immediately but delays returning
 * until `resolve()` or `reject()` is called. Use with `jest.fn` (or any callable) to
 * assert state between "work started" and "async boundary completed".
 *
 * **One-shot:** Only one in-flight `fn` at a time. Each `resolve` / `reject` applies
 * to at most one pending gate. Calling `fn` again before the previous call finishes,
 * or calling `resolve` / `reject` when nothing is waiting, throws.
 */
export function createAsyncGate<TArgs extends unknown[], TResult>(
    impl: (...args: TArgs) => TResult | Promise<TResult>
): AsyncGateControls<TArgs, TResult> {
    let openGate: (() => void) | null = null
    let failGate: ((reason?: unknown) => void) | null = null
    let inFlight = false

    const duplicateCallError = (): Error => new Error(
        'createAsyncGate: fn was invoked while a previous call is still waiting for resolve() or reject()'
    )

    const fn = (...args: TArgs): Promise<TResult> => {
        if (inFlight) {
            return Promise.reject(duplicateCallError())
        }
        inFlight = true
        const gate = new Promise<void>((resolve, reject) => {
            openGate = () => {
                resolve()
            }
            failGate = (reason?: unknown) => {
                reject(reason)
            }
        })

        return (async (): Promise<TResult> => {
            try {
                const result = await impl(...args)
                await gate
                return result
            } finally {
                inFlight = false
                openGate = null
                failGate = null
            }
        })()
    }

    const resolve = (): void => {
        if (openGate === null) {
            throw new Error('createAsyncGate: resolve() called with no pending fn awaiting the gate')
        }
        const open = openGate
        openGate = null
        failGate = null
        open()
    }

    const reject = (reason?: unknown): void => {
        if (failGate === null) {
            throw new Error('createAsyncGate: reject() called with no pending fn awaiting the gate')
        }
        const fail = failGate
        openGate = null
        failGate = null
        fail(reason)
    }

    return { fn, resolve, reject }
}
