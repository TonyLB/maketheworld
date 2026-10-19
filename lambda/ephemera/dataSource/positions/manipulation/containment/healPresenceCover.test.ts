import type { EphemeraFeatureId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'

jest.mock('../kernel/commitStepSequence', () => ({
    __esModule: true,
    commitStepSequence: jest.fn(),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getLudicGraph: jest.fn(),
        },
    },
}))

import internalCache from '../../../../internalCache'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { healPresenceCover } from './healPresenceCover'

const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId
const STOVE = 'FEATURE#Stove' as EphemeraFeatureId
const SINK = 'FEATURE#Sink' as EphemeraFeatureId
const ROOT = 'PRESENCE#root' as EphemeraPresenceNodeId
const CARVE = 'PRESENCE#carve' as EphemeraPresenceNodeId
const STOVE_BINDING = 'PRESENCE#stove' as EphemeraPresenceNodeId

const withGraphs = (graphs: Record<string, EphemeraLudicGraph>) => {
    ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) => {
        if (!graphs[hostId]) {
            throw new Error(`no graph ${hostId}`)
        }
        return graphs[hostId]
    })
}

const roomWith = (carveMembers: { host: EphemeraFeatureId; presence: EphemeraPresenceNodeId }[]) => testLudicGraph(ROOM_ID, {
    nodes: [
        { tag: 'Feature', universalKey: STOVE },
        { tag: 'Feature', universalKey: SINK },
        presenceBindingNode(ROOT, undefined, { members: [{ host: SINK, presence: 'PRESENCE#sink' as EphemeraPresenceNodeId }] }),
        presenceBindingNode(CARVE, undefined, { members: carveMembers }),
    ],
})

const stoveGraph = testLudicGraph(STOVE, { nodes: [presenceBindingNode(STOVE_BINDING, { host: ROOM_ID, presence: CARVE })] })
const sinkGraph = testLudicGraph(SINK, { nodes: [presenceBindingNode('PRESENCE#sink', { host: ROOM_ID, presence: ROOT })] })

describe('healPresenceCover', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
    })

    it('rewrites a cover from member pointers, in place, leaving a correct cover alone', async () => {
        withGraphs({ [ROOM_ID]: roomWith([]), [STOVE]: stoveGraph, [SINK]: sinkGraph })

        await healPresenceCover(ROOM_ID, { messageBus, streamEvent })

        const steps = (commitStepSequence as jest.Mock).mock.calls[0][0].steps
        expect(steps).toEqual([{
            kind: 'repairPresenceBinding',
            hostId: ROOM_ID,
            presenceId: CARVE,
            fromHostPresences: [],
            cover: { members: [{ host: STOVE, presence: STOVE_BINDING }] },
        }])
    })

    it('commits nothing once the cover matches the pointers (a redelivered finding)', async () => {
        withGraphs({ [ROOM_ID]: roomWith([{ host: STOVE, presence: STOVE_BINDING }]), [STOVE]: stoveGraph, [SINK]: sinkGraph })

        await healPresenceCover(ROOM_ID, { messageBus, streamEvent })

        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('writes nothing when a member graph cannot be read', async () => {
        withGraphs({ [ROOM_ID]: roomWith([]), [STOVE]: stoveGraph })
        jest.spyOn(console, 'error').mockImplementation(() => undefined)

        await healPresenceCover(ROOM_ID, { messageBus, streamEvent })

        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    describe('as a member (orphaned pointer)', () => {
        const roomLackingStove = testLudicGraph(ROOM_ID, {
            nodes: [presenceBindingNode(ROOT), presenceBindingNode(CARVE)],
        })

        it('repairs the binding in place, pointer and cover unchanged, when the host holds the named binding', async () => {
            withGraphs({ [ROOM_ID]: roomLackingStove, [STOVE]: stoveGraph })

            await healPresenceCover(STOVE, { messageBus, streamEvent })

            expect((commitStepSequence as jest.Mock).mock.calls[0][0].steps).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: STOVE,
                presenceId: STOVE_BINDING,
                fromHostPresences: [{ host: ROOM_ID, presence: CARVE }],
                cover: { members: [] },
            }])
        })

        it('repairs a shared binding without dropping a parent: the step carries the whole parent set', async () => {
            const sharedStove = testLudicGraph(STOVE, {
                nodes: [presenceBindingNode(STOVE_BINDING, [{ host: ROOM_ID, presence: ROOT }, { host: ROOM_ID, presence: CARVE }])],
            })
            withGraphs({ [ROOM_ID]: roomLackingStove, [STOVE]: sharedStove })

            await healPresenceCover(STOVE, { messageBus, streamEvent })

            expect((commitStepSequence as jest.Mock).mock.calls[0][0].steps).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: STOVE,
                presenceId: STOVE_BINDING,
                fromHostPresences: [{ host: ROOM_ID, presence: ROOT }, { host: ROOM_ID, presence: CARVE }],
                cover: { members: [] },
            }])
        })

        it('writes nothing when the host holds the node (a redelivered finding)', async () => {
            withGraphs({ [ROOM_ID]: roomWith([{ host: STOVE, presence: STOVE_BINDING }]), [STOVE]: stoveGraph })

            await healPresenceCover(STOVE, { messageBus, streamEvent })

            expect(commitStepSequence).not.toHaveBeenCalled()
        })

        it('writes nothing when the host row is missing or lacks the named binding', async () => {
            withGraphs({ [STOVE]: stoveGraph })
            await healPresenceCover(STOVE, { messageBus, streamEvent })
            withGraphs({ [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode(ROOT)] }), [STOVE]: stoveGraph })
            await healPresenceCover(STOVE, { messageBus, streamEvent })

            expect(commitStepSequence).not.toHaveBeenCalled()
        })
    })
})
