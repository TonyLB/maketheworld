import type { EphemeraAreaId, EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
import { populateContainmentAtCache } from './populateContainmentAtCache'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_A = 'ROOM#Cafe' as EphemeraRoomId
const ROOM_B = 'ROOM#Kitchen' as EphemeraRoomId
const FEATURE_A = 'FEATURE#Counter' as EphemeraFeatureId
const FEATURE_B = 'FEATURE#Espresso' as EphemeraFeatureId

describe('populateContainmentAtCache', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
    })

    it('ignores child references that are not Room, Feature or Object ids', async () => {
        await populateContainmentAtCache(FEATURE_A, [{ universalKey: 'CHARACTER#Alpha' }], { messageBus, streamEvent })

        expect(internalCache.Positions.getLudicGraph).not.toHaveBeenCalled()
        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('batches a Room, a Feature and an Object into one commit', async () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === AREA_ID ? parentGraph : testLudicGraph(hostId as any, { nodes: [] })
        )

        await populateContainmentAtCache(AREA_ID, [{ universalKey: ROOM_A }, { universalKey: FEATURE_A }, { universalKey: 'OBJECT#Cup' }], { messageBus, streamEvent })

        expect(commitStepSequence).toHaveBeenCalledTimes(1)
        const [{ steps }] = (commitStepSequence as jest.Mock).mock.calls[0]
        expect(steps.filter((step: any) => step.kind === 'establishRelation').map((step: any) => step.relationKind)).toEqual(['PartOf', 'PartOf', 'In'])
    })

    it('does nothing when every named child is already fully populated', async () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [{ tag: 'Room', universalKey: ROOM_A }, presenceBindingNode('Base')],
            edges: [{ tag: 'Relational', from: ROOM_A, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_A, {
            nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#binding-1', fromHostPresences: [{ host: AREA_ID, presence: 'PRESENCE#Base' }], cover: { members: [] } }],
        })
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === AREA_ID ? parentGraph : childGraph
        )

        await populateContainmentAtCache(AREA_ID, [{ universalKey: ROOM_A }], { messageBus, streamEvent })

        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('batches every named child\'s missing steps into one commitStepSequence call', async () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === AREA_ID ? parentGraph : testLudicGraph(hostId as any, { nodes: [] })
        )

        await populateContainmentAtCache(AREA_ID, [{ universalKey: ROOM_A }, { universalKey: ROOM_B }], { messageBus, streamEvent })

        expect(commitStepSequence).toHaveBeenCalledTimes(1)
        const [{ steps }, deps] = (commitStepSequence as jest.Mock).mock.calls[0]
        expect(steps).toHaveLength(5) // the Area's root, then 2 steps (binding, edge) x 2 children
        expect(steps[0]).toEqual({ kind: 'addPresenceBinding', hostId: AREA_ID, fromHostPresences: [], presenceUuid: expect.any(String) })
        expect(steps.filter((step: any) => step.kind === 'addPresenceBinding' && step.fromHostPresences.length)).toHaveLength(2)
        expect(deps.messageBus).toBe(messageBus)
        expect(deps.getCurrentHost()).toBe(AREA_ID)
    })

    it('mints a childless room\'s hostless remainder, and a second run commits nothing', async () => {
        const emptyRoom = testLudicGraph(ROOM_A, { nodes: [] })
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(emptyRoom)

        await populateContainmentAtCache(ROOM_A, [], { messageBus, streamEvent })

        expect(commitStepSequence).toHaveBeenCalledTimes(1)
        const [{ steps }] = (commitStepSequence as jest.Mock).mock.calls[0]
        expect(steps).toEqual([{ kind: 'addPresenceBinding', hostId: ROOM_A, fromHostPresences: [], presenceUuid: expect.any(String) }])

        ;(commitStepSequence as jest.Mock).mockClear()
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(
            testLudicGraph(ROOM_A, { nodes: [presenceBindingNode('Base')] })
        )
        await populateContainmentAtCache(ROOM_A, [], { messageBus, streamEvent })
        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('mints one remainder per room, however many children point at it', async () => {
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            testLudicGraph(hostId as any, { nodes: [] })
        )

        await populateContainmentAtCache(ROOM_A, [{ universalKey: FEATURE_A }, { universalKey: FEATURE_B }], { messageBus, streamEvent })

        const [{ steps }] = (commitStepSequence as jest.Mock).mock.calls[0]
        const roomMints = steps.filter((step: any) => step.kind === 'addPresenceBinding' && step.hostId === ROOM_A)
        expect(roomMints).toHaveLength(1)
        const remainderKey = `PRESENCE#${roomMints[0].presenceUuid}`
        const childBindings = steps.filter((step: any) => step.kind === 'addPresenceBinding' && step.hostId !== ROOM_A)
        expect(childBindings.map((step: any) => step.fromHostPresences[0])).toEqual([
            { host: ROOM_A, presence: remainderKey },
            { host: ROOM_A, presence: remainderKey },
        ])
    })

    it('does nothing for a childless parent that is neither a Room nor an Area', async () => {
        await populateContainmentAtCache(FEATURE_A, [], { messageBus, streamEvent })

        expect(internalCache.Positions.getLudicGraph).not.toHaveBeenCalled()
        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('mints a childless Area\'s hostless remainder, and a second run commits nothing', async () => {
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(testLudicGraph(AREA_ID, { nodes: [] }))

        await populateContainmentAtCache(AREA_ID, [], { messageBus, streamEvent })

        const [{ steps }] = (commitStepSequence as jest.Mock).mock.calls[0]
        expect(steps).toEqual([{ kind: 'addPresenceBinding', hostId: AREA_ID, fromHostPresences: [], presenceUuid: expect.any(String) }])

        ;(commitStepSequence as jest.Mock).mockClear()
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(
            testLudicGraph(AREA_ID, { nodes: [presenceBindingNode('Base')] })
        )
        await populateContainmentAtCache(AREA_ID, [], { messageBus, streamEvent })
        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('logs but does not throw when commitStepSequence fails', async () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        const childGraph = testLudicGraph(ROOM_A, { nodes: [] })
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === AREA_ID ? parentGraph : childGraph
        )
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'boom' })
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

        await expect(populateContainmentAtCache(AREA_ID, [{ universalKey: ROOM_A }], { messageBus, streamEvent })).resolves.toBeUndefined()

        expect(consoleError).toHaveBeenCalled()
        consoleError.mockRestore()
    })
})
