import type { EphemeraAreaId, EphemeraFeatureId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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
import { healContainmentPopulation } from './healContainmentPopulation'
import { parentRemainderKey } from '../../ludicGraph/testFixtures'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Stove' as EphemeraFeatureId
const OBJECT_ID = 'OBJECT#Kettle' as EphemeraObjectId
const HOST_ONLY_BINDING = 'PRESENCE#stove-host-only' as EphemeraPresenceNodeId
const ROOM_REMAINDER = 'PRESENCE#kitchen-remainder' as EphemeraPresenceNodeId

const partOf = (from: EphemeraLudicTerminalId, to: EphemeraLudicTerminalId) => ({ tag: 'Relational' as const, from, to, kind: 'PartOf' as const })

const withGraphs = (graphs: Record<string, EphemeraLudicGraph>) => {
    ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) => graphs[hostId] ?? testLudicGraph(hostId as any))
}

const committedSteps = (): any[] => (commitStepSequence as jest.Mock).mock.calls[0][0].steps

describe('healContainmentPopulation', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
    })

    it('mints the room parent\'s remainder and repairs a child binding that could name no parent binding', async () => {
        withGraphs({
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [{ tag: 'Feature', universalKey: FEATURE_ID }],
                edges: [partOf(FEATURE_ID, ROOM_ID)],
            }),
            [FEATURE_ID]: testLudicGraph(FEATURE_ID, {
                nodes: [{ tag: 'Presence', universalKey: HOST_ONLY_BINDING, fromHostPresence: { host: ROOM_ID, presence: 'PRESENCE#gone' as EphemeraPresenceNodeId }, cover: { members: [] } }],
            }),
        })

        await healContainmentPopulation(ROOM_ID, { messageBus, streamEvent })

        const steps = committedSteps()
        const mint = steps.find((step) => step.kind === 'addPresenceBinding')
        expect(mint).toMatchObject({ hostId: ROOM_ID })
        expect(mint.fromHostPresence).toBeUndefined()
        const repair = steps.find((step) => step.kind === 'repairPresenceBinding')
        expect(repair).toMatchObject({
            hostId: FEATURE_ID,
            presenceId: HOST_ONLY_BINDING,
            fromHostPresence: { host: ROOM_ID, presence: `PRESENCE#${mint.presenceUuid}` },
        })
        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'repairPresenceBinding'])
    })

    it('repairs a room\'s Area binding that lists members to an empty-member carve-out naming the Area\'s root', async () => {
        withGraphs({
            [AREA_ID]: testLudicGraph(AREA_ID, {
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                edges: [partOf(ROOM_ID, AREA_ID)],
            }),
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [{ tag: 'Feature', universalKey: FEATURE_ID }, presenceBindingNode('kitchen-in-area', AREA_ID, { members: [{ host: FEATURE_ID, presence: 'PRESENCE#stove-in-kitchen' as EphemeraPresenceNodeId }] })],
            }),
        })

        await healContainmentPopulation(AREA_ID, { messageBus, streamEvent })

        // The Area's own root is minted first, and the carve-out names it.
        const steps = committedSteps()
        expect(steps).toEqual([
            { kind: 'addPresenceBinding', hostId: AREA_ID, presenceUuid: expect.any(String) },
            expect.objectContaining({
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: 'PRESENCE#kitchen-in-area',
                fromHostPresence: { host: AREA_ID, presence: `PRESENCE#${steps[0].presenceUuid}` },
                cover: { members: [] },
            }),
        ])
    })

    it('commits nothing when every child is already in the current shape', async () => {
        withGraphs({
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Feature', universalKey: FEATURE_ID },
                    presenceBindingNode(ROOM_REMAINDER),
                ],
                edges: [partOf(FEATURE_ID, ROOM_ID)],
            }),
            [FEATURE_ID]: testLudicGraph(FEATURE_ID, {
                nodes: [presenceBindingNode('stove-in-kitchen', { host: ROOM_ID, presence: ROOM_REMAINDER })],
            }),
        })

        await healContainmentPopulation(ROOM_ID, { messageBus, streamEvent })

        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('mints the root remainder of a room with no children', async () => {
        withGraphs({ [ROOM_ID]: testLudicGraph(ROOM_ID) })

        await healContainmentPopulation(ROOM_ID, { messageBus, streamEvent })

        expect(committedSteps()).toEqual([{ kind: 'addPresenceBinding', hostId: ROOM_ID, presenceUuid: expect.any(String) }])
    })

    it('only reruns population for Room/Feature PartOf sources into the parent', async () => {
        withGraphs({
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [{ tag: 'Object', universalKey: OBJECT_ID }, presenceBindingNode(ROOM_REMAINDER)],
                edges: [partOf(OBJECT_ID, ROOM_ID)],
            }),
        })

        await healContainmentPopulation(ROOM_ID, { messageBus, streamEvent })

        expect(internalCache.Positions.getLudicGraph).not.toHaveBeenCalledWith(OBJECT_ID)
        expect(commitStepSequence).not.toHaveBeenCalled()
    })
})
