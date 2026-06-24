import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { produce } from 'immer'

import {
    computeTakeHoldDiff,
    updateTakeHoldPositionGraphs,
} from './updateTakeHoldPositionGraphs'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const OTHER_CHARACTER = 'CHARACTER#Beta' as EphemeraCharacterId

describe('computeTakeHoldDiff', () => {
    it('detects pick-up from room to character', () => {
        const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [ROOM_ID],
            to: CHARACTER_ID,
            changed: true,
        })
        expect(roomDiff).toEqual({ froms: [ROOM_ID], to: null, changed: true })
        expect(characterDiff).toEqual({ froms: [], to: CHARACTER_ID, changed: true })
    })

    it('is idempotent when object is already solely on target character', () => {
        const { diff } = computeTakeHoldDiff({
            priorContainers: [CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff).toEqual({
            froms: [],
            to: CHARACTER_ID,
            changed: false,
        })
    })

    it('removes from room when object is on target character and source room (drift)', () => {
        const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, CHARACTER_ID],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(diff.changed).toBe(true)
        expect(diff.froms).toEqual([ROOM_ID])
        expect(roomDiff.changed).toBe(true)
        expect(characterDiff.changed).toBe(false)
    })

    it('moves object between character hosts when also in source room', () => {
        const { characterDiff } = computeTakeHoldDiff({
            priorContainers: [ROOM_ID, OTHER_CHARACTER],
            roomId: ROOM_ID,
            characterId: CHARACTER_ID,
        })

        expect(characterDiff).toEqual({
            froms: [OTHER_CHARACTER],
            to: CHARACTER_ID,
            changed: true,
        })
    })
})

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
                getRoomPositionGraph: async () => roomGraphWithObject,
                getCharacterPositionGraph: async () => emptyCharacterGraph,
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
                getRoomPositionGraph: async () => roomGraphWithObject,
                getCharacterPositionGraph: async () => emptyCharacterGraph,
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
