import { PERSISTENT_COMMAND_TTL_MS, isPersistentCommandExpired, persistentCommandDeleteAt } from './lifetime'

describe('persistentCommand lifetime', () => {
    const nowMs = 1_700_000_000_500

    it('computes deleteAt in epoch seconds', () => {
        expect(persistentCommandDeleteAt(nowMs)).toEqual(Math.floor((nowMs + PERSISTENT_COMMAND_TTL_MS) / 1000))
    })

    it('treats a row without deleteAt as live', () => {
        expect(isPersistentCommandExpired({}, nowMs)).toBe(false)
    })

    it('treats a future deleteAt as live', () => {
        expect(isPersistentCommandExpired({ deleteAt: Math.floor(nowMs / 1000) + 1 }, nowMs)).toBe(false)
    })

    it('treats a past or equal deleteAt as expired', () => {
        expect(isPersistentCommandExpired({ deleteAt: Math.floor(nowMs / 1000) - 1 }, nowMs)).toBe(true)
        expect(isPersistentCommandExpired({ deleteAt: Math.floor(nowMs / 1000) }, nowMs)).toBe(true)
    })
})
