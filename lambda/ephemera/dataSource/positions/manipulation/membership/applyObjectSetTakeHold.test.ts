import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectSetTakeHold } from './applyObjectSetTakeHold'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
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
 * `MultiKeyUpdate`-based implementation in full (BD-13 worked example, race-condition
 * detection, degenerate/empty-set behavior). This just confirms the room -> character
 * direction is wired correctly. The mocked `transactWrite` simulates the real library's
 * `MultiKeyUpdate` handling (fetch + invoke reducer), since `applyObjectSetTransfer` no
 * longer does its own separate fetch --- `transactWrite`'s own fetch is the only one.
 */
describe('applyObjectSetTakeHold', () => {
    it('delegates to applyObjectSetTransfer with direction "takeHold"', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
        const graphsByHost: Record<string, EphemeraPositionGraph> = { [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph }
        const transactWrite: any = jest.fn(async (items: any[]) => {
            const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
            const draft: Record<string, any> = {}
            multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
                draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                    EphemeraId: key.EphemeraId,
                    DataCategory: key.DataCategory,
                    positionGraph: graphsByHost[key.EphemeraId].toStored(),
                }
            })
            multiKeyItem.reducer(draft)
        })
        const messageBus = { publish: jest.fn() }
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        const result = await applyObjectSetTakeHold(
            { objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toMatchObject({
            ok: true,
            diffs: [{ objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true }],
        })
    })
})
