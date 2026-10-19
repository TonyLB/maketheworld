jest.mock('../kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { commitStepSequence } from '../kernel/commitStepSequence'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { executeComponentCreation } from './executeComponentCreation'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const getGraph = async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId, { nodes: [presenceBindingNode(parentRemainderKey(hostId as EphemeraRoomId))] })
const META = { EphemeraId: OBJECT_ID, DataCategory: 'Meta::Object' as const, stableKey: 'skates' }

describe('executeComponentCreation', () => {
    const commitMock = commitStepSequence as jest.MockedFunction<typeof commitStepSequence>
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        commitMock.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map() })
    })

    it('commits createComponent followed by the first-placement move, in one sequence (the move applies membership)', async () => {
        const pairItem = { Put: { EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' } } as any
        const afterPersist = jest.fn()

        const result = await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            getGraph,
            existenceItems: [pairItem],
            messageBus: messageBus as any,
            streamEvent,
            afterPersist,
        })

        expect(result).toEqual({ ok: true, beatAnchorTime: 1 })
        expect(commitMock).toHaveBeenCalledTimes(1)
        const [args, deps] = commitMock.mock.calls[0]
        const createStep = args.steps[0] as { presenceUuid: string }
        expect(args.steps).toEqual([
            { kind: 'createComponent', hostId: OBJECT_ID, meta: META },
            { kind: 'movePresenceBinding', hostId: OBJECT_ID, presence: 'PRESENCE#Base', from: null, to: { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) } },
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
            { kind: 'createComponent', hostId: OBJECT_ID, meta: META },
        ])
    })

    it('passes a commit failure through', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        commitMock.mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })

        const result = await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            getGraph,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })
        consoleSpy.mockRestore()
    })

    it('refuses, committing nothing, when the destination holds no binding to land under', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const result = await executeComponentCreation({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            getGraph: async (hostId) => testLudicGraph(hostId as EphemeraRoomId, { nodes: [] }),
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual({ ok: false, errorCode: 'destinationBindingMissing', errorMessage: 'destinationBindingMissing' })
        expect(commitMock).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
