import { createAsyncGate } from './asyncGate'

describe('createAsyncGate', () => {
    it('defers returning until resolve() with the impl result', async () => {
        const impl = jest.fn(() => ({ ok: true as const }))
        const { fn, resolve } = createAsyncGate(impl)

        const pending = fn()
        expect(impl).toHaveBeenCalledTimes(1)
        await Promise.resolve()
        let settled = false
        pending.then(() => { settled = true })
        await Promise.resolve()
        expect(settled).toBe(false)

        resolve()
        await expect(pending).resolves.toEqual({ ok: true })
    })

    it('rejects fn when reject() is called', async () => {
        const impl = jest.fn(() => 'done')
        const { fn, reject } = createAsyncGate(impl)

        const pending = fn()
        reject(new Error('boom'))
        await expect(pending).rejects.toThrow('boom')
    })

    it('propagates impl throw without needing the gate', async () => {
        const impl = jest.fn(() => {
            throw new Error('impl failed')
        })
        const { fn, resolve } = createAsyncGate(impl)

        await expect(fn()).rejects.toThrow('impl failed')
        expect(() => resolve()).toThrow(/no pending fn/)
    })

    it('propagates impl promise rejection', async () => {
        const impl = jest.fn(() => Promise.reject(new Error('async impl')))
        const { fn, resolve } = createAsyncGate(impl)

        await expect(fn()).rejects.toThrow('async impl')
        expect(() => resolve()).toThrow(/no pending fn/)
    })

    it('rejects if fn is invoked twice before resolve', async () => {
        const { fn, resolve } = createAsyncGate(jest.fn(() => 1))

        void fn()
        await expect(fn()).rejects.toThrow(/still waiting for resolve/)
        resolve()
        await Promise.resolve()
    })

    it('allows a new fn call after the previous gate resolves', async () => {
        const { fn, resolve } = createAsyncGate(jest.fn(() => 1))
        const first = fn()
        resolve()
        await expect(first).resolves.toBe(1)
        const second = fn()
        resolve()
        await expect(second).resolves.toBe(1)
    })

    it('throws on second resolve()', async () => {
        const { fn, resolve } = createAsyncGate(jest.fn(() => 0))

        void fn()
        resolve()
        expect(() => resolve()).toThrow(/no pending fn/)
        await Promise.resolve()
    })

    it('throws resolve() when nothing is pending', () => {
        const { resolve } = createAsyncGate(jest.fn())
        expect(() => resolve()).toThrow(/no pending fn/)
    })

    it('throws reject() when nothing is pending', () => {
        const { reject } = createAsyncGate(jest.fn())
        expect(() => reject(new Error('x'))).toThrow(/no pending fn/)
    })
})
