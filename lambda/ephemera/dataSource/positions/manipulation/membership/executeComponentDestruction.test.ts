jest.mock('../kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { EphemeraLudicGraph } from '../../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { executeComponentDestruction } from './executeComponentDestruction'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

describe('executeComponentDestruction', () => {
    const commitMock = commitStepSequence as jest.MockedFunction<typeof commitStepSequence>
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    // the object holds one binding, under the room's remainder
    const getGraph = async (hostId: any) => hostId === OBJECT_ID
        ? testLudicGraph(OBJECT_ID, { nodes: [presenceBindingNode('p1', ROOM_ID)] })
        : EphemeraLudicGraph.empty(hostId)

    beforeEach(() => {
        jest.clearAllMocks()
        commitMock.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map() })
    })

    it('commits a departure per binding and destroyComponent in one sequence, handing afterPersist the hosts left', async () => {
        const rowItem = { Delete: { EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' } } as any
        const afterPersist = jest.fn()

        const result = await executeComponentDestruction({
            objectId: OBJECT_ID,
            existenceItems: [rowItem],
            messageBus: messageBus as any,
            streamEvent,
            afterPersist,
            getMembershipContainers: async () => [ROOM_ID],
            getGraph,
        })

        expect(result).toEqual({ ok: true, froms: [ROOM_ID], beatAnchorTime: 1 })
        expect(commitMock).toHaveBeenCalledTimes(1)
        const [args, deps] = commitMock.mock.calls[0]
        expect(args.steps).toEqual([
            { kind: 'movePresenceBinding', to: null, hostId: OBJECT_ID, presence: 'PRESENCE#p1', from: { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) }, cover: expect.any(Object) },
            { kind: 'destroyComponent', hostId: OBJECT_ID },
        ])
        expect(args.existenceItems).toEqual([rowItem])
        deps.afterPersist!()
        expect(afterPersist).toHaveBeenCalledWith([ROOM_ID])
    })

    it('an orphan (no containers) is destroyed with no departure at all', async () => {
        await executeComponentDestruction({
            objectId: OBJECT_ID,
            messageBus: messageBus as any,
            streamEvent,
            getMembershipContainers: async () => [],
            getGraph,
        })

        expect(commitMock.mock.calls[0][0].steps).toEqual([{ kind: 'destroyComponent', hostId: OBJECT_ID }])
    })

    it('passes a commit failure through', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        commitMock.mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })

        const result = await executeComponentDestruction({
            objectId: OBJECT_ID,
            messageBus: messageBus as any,
            streamEvent,
            getMembershipContainers: async () => [ROOM_ID],
            getGraph,
        })

        expect(result).toEqual({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'stale' })
        consoleSpy.mockRestore()
    })
})
