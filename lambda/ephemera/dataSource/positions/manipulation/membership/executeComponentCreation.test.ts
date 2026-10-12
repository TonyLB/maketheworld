jest.mock('../kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { commitStepSequence } from '../kernel/commitStepSequence'
import { executeComponentCreation } from './executeComponentCreation'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const META = { EphemeraId: OBJECT_ID, DataCategory: 'Meta::Object' as const, stableKey: 'skates' }

describe('executeComponentCreation', () => {
    const commitMock = commitStepSequence as jest.MockedFunction<typeof commitStepSequence>
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        commitMock.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map() })
    })

    it('commits createComponent followed by the first-placement move, in one sequence', async () => {
        const pairItem = { Put: { EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' } } as any
        const afterPersist = jest.fn()

        const result = await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            existenceItems: [pairItem],
            messageBus: messageBus as any,
            streamEvent,
            afterPersist,
        })

        expect(result).toEqual({ ok: true, beatAnchorTime: 1 })
        expect(commitMock).toHaveBeenCalledTimes(1)
        const [args, deps] = commitMock.mock.calls[0]
        expect(args.steps).toEqual([
            { kind: 'createComponent', hostId: OBJECT_ID, presenceUuid: expect.any(String), meta: META },
            { kind: 'transferMembership', entityId: OBJECT_ID, fromHostIds: new Set(), toHostId: ROOM_ID },
            { kind: 'rehostPresenceBinding', hostId: OBJECT_ID, fromHostIds: [], toHostId: ROOM_ID, presenceUuid: expect.any(String) },
        ])
        expect(args.existenceItems).toEqual([pairItem])
        expect(deps.afterPersist).toBe(afterPersist)
    })

    it('with no target, creates the component unplaced: the create step alone', async () => {
        await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: null,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(commitMock.mock.calls[0][0].steps).toEqual([
            { kind: 'createComponent', hostId: OBJECT_ID, presenceUuid: expect.any(String), meta: META },
        ])
    })

    it('passes a commit failure through', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        commitMock.mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })

        const result = await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })
        consoleSpy.mockRestore()
    })
})
