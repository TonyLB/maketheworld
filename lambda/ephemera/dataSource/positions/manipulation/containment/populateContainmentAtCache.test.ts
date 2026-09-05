import type { EphemeraAreaId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../ludicGraph/testFixtures'

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

describe('populateContainmentAtCache', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
    })

    it('ignores child references that are not Room or Feature ids', async () => {
        await populateContainmentAtCache(AREA_ID, [{ universalKey: 'CHARACTER#Alpha' }], { messageBus, streamEvent })

        expect(internalCache.Positions.getLudicGraph).not.toHaveBeenCalled()
        expect(commitStepSequence).not.toHaveBeenCalled()
    })

    it('does nothing when every named child is already fully populated', async () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [{ tag: 'Room', universalKey: ROOM_A }],
            edges: [{ tag: 'Relational', from: ROOM_A, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_A, {
            ports: [{ portId: 'port-1', fromHostId: AREA_ID, kind: 'Present' }],
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
        expect(steps).toHaveLength(6) // 3 steps x 2 children
        expect(steps.filter((step: any) => step.kind === 'transferMembership')).toHaveLength(2)
        expect(deps.messageBus).toBe(messageBus)
        expect(deps.getCurrentHost()).toBe(AREA_ID)
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
