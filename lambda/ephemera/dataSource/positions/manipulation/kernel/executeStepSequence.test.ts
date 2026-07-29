import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const commitStepSequence = jest.fn()
const presentStepSequence = jest.fn()

jest.mock('./commitStepSequence', () => ({
    __esModule: true,
    commitStepSequence: (...args: any[]) => commitStepSequence(...args),
}))

jest.mock('./presentStepSequence', () => ({
    __esModule: true,
    presentStepSequence: (...args: any[]) => presentStepSequence(...args),
}))

import { executeStepSequence } from './executeStepSequence'
import type { KernelStep } from './kernelStep'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const OBJECT_ID = 'OBJECT#Tray' as EphemeraObjectId

const commitDeps = { messageBus: {} as any, streamEvent: jest.fn(), getCurrentHost: () => ROOM_ID }
const perceiveDeps = { streamEvent: jest.fn() }

describe('executeStepSequence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('awaits commitStepSequence to completion before invoking presentStepSequence, for a mixed step list', async () => {
        const callOrder: string[] = []
        commitStepSequence.mockImplementation(async () => {
            callOrder.push('commit')
            return { ok: true, beatAnchorTime: 1, steps: [] }
        })
        presentStepSequence.mockImplementation(async () => {
            callOrder.push('perceive')
        })

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
            { kind: 'describe', referentId: ROOM_ID, referentKind: 'room' },
        ]

        const result = await executeStepSequence(steps, CHARACTER_ID, { commit: commitDeps, perceive: perceiveDeps })

        expect(callOrder).toEqual(['commit', 'perceive'])
        expect(result).toEqual({ ok: true, beatAnchorTime: 1, steps: [] })

        expect(commitStepSequence).toHaveBeenCalledWith(
            { steps: [steps[0]] },
            commitDeps
        )
        expect(presentStepSequence).toHaveBeenCalledWith(steps, CHARACTER_ID, perceiveDeps)
    })

    it('does not invoke presentStepSequence when commitStepSequence reports ok:false', async () => {
        commitStepSequence.mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
            { kind: 'describe', referentId: ROOM_ID, referentKind: 'room' },
        ]

        const result = await executeStepSequence(steps, CHARACTER_ID, { commit: commitDeps, perceive: perceiveDeps })

        expect(result.ok).toBe(false)
        expect(presentStepSequence).not.toHaveBeenCalled()
    })

    it('a pure-mutation list still calls commitStepSequence with the full set and presentStepSequence with an empty describe filter result', async () => {
        commitStepSequence.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [] })
        presentStepSequence.mockResolvedValue(undefined)

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([OBJECT_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
        ]

        await executeStepSequence(steps, CHARACTER_ID, { commit: commitDeps, perceive: perceiveDeps })

        expect(commitStepSequence).toHaveBeenCalledWith({ steps }, commitDeps)
        expect(presentStepSequence).toHaveBeenCalledWith(steps, CHARACTER_ID, perceiveDeps)
    })

    it('a pure-describe list calls commitStepSequence with zero mutation steps (no transactWrite fires for it)', async () => {
        commitStepSequence.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [] })
        presentStepSequence.mockResolvedValue(undefined)

        const steps: KernelStep[] = [{ kind: 'describe', referentId: ROOM_ID, referentKind: 'room' }]

        await executeStepSequence(steps, CHARACTER_ID, { commit: commitDeps, perceive: perceiveDeps })

        expect(commitStepSequence).toHaveBeenCalledWith({ steps: [] }, commitDeps)
        expect(presentStepSequence).toHaveBeenCalledWith(steps, CHARACTER_ID, perceiveDeps)
    })
})
