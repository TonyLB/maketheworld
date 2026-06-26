import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { produce } from 'immer'

import { updateTakeHoldPositionGraphs } from './updateTakeHoldPositionGraphs'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('updateTakeHoldPositionGraphs', () => {
    const transactWrite = jest.fn().mockResolvedValue(undefined)

    const roomGraphWithObject = {
        nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
        edges: [] as [],
    }

    const emptyCharacterGraph = { nodes: [], edges: [] as [] }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('persists room-remove and character-add in one transact', async () => {
        const result = await updateTakeHoldPositionGraphs(
            { objectId: OBJECT_ID, roomId: ROOM_ID, characterId: CHARACTER_ID },
            {
                getMembershipContainers: async () => [ROOM_ID],
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_ID ? roomGraphWithObject : emptyCharacterGraph,
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: true,
            persisted: true,
            diff: {
                froms: [ROOM_ID],
                to: CHARACTER_ID,
                changed: true,
            },
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0] as any[]
        expect(items).toHaveLength(4)

        const roomGraphDraft = produce({ positionGraph: roomGraphWithObject }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(roomGraphDraft.positionGraph?.nodes).toEqual([])

        const characterGraphDraft = produce({ positionGraph: emptyCharacterGraph }, (draft) => {
            items[2].Update.updateReducer(draft)
        })
        expect(characterGraphDraft.positionGraph?.nodes).toEqual([
            { tag: 'Object', universalKey: OBJECT_ID },
        ])
    })

    it('skips transact when already solely on target character', async () => {
        const result = await updateTakeHoldPositionGraphs(
            { objectId: OBJECT_ID, roomId: ROOM_ID, characterId: CHARACTER_ID },
            {
                getMembershipContainers: async () => [CHARACTER_ID],
                transactWrite,
            }
        )

        expect(result).toEqual({
            ok: true,
            persisted: false,
            diff: { froms: [], to: CHARACTER_ID, changed: false },
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('returns error when transact fails', async () => {
        transactWrite.mockRejectedValueOnce(new Error('transact failed'))

        const result = await updateTakeHoldPositionGraphs(
            { objectId: OBJECT_ID, roomId: ROOM_ID, characterId: CHARACTER_ID },
            {
                getMembershipContainers: async () => [ROOM_ID],
                getPositionGraph: async (hostId) =>
                    hostId === ROOM_ID ? roomGraphWithObject : emptyCharacterGraph,
                transactWrite,
            }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'OBJECT_TAKE_HOLD_TRANSACT_FAILED',
            errorMessage: 'transact failed',
        })
    })
})
