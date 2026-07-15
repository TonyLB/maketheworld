import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectSetDrop } from './applyObjectSetDrop'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getPositionGraph: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Thin directional wrapper --- `applyObjectSetTransfer.test.ts` covers the shared
 * `MultiKeyUpdate`-based implementation in full. This just confirms the
 * character -> room direction is wired correctly.
 */
describe('applyObjectSetDrop', () => {
    it('delegates to applyObjectSetTransfer with direction "drop"', async () => {
        const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
        const getPositionGraph = async (hostId: string): Promise<EphemeraPositionGraph> =>
            hostId === ROOM_ID ? emptyRoomGraph : characterGraph
        const transactWrite = jest.fn().mockResolvedValue(undefined)
        const messageBus = { publish: jest.fn() }
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        const result = await applyObjectSetDrop(
            { objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result).toMatchObject({
            ok: true,
            diffs: [{ objectId: TRAY_ID, froms: [CHARACTER_ID], to: ROOM_ID, changed: true }],
        })
    })
})
