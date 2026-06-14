import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
        getItem: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: { get: jest.fn() },
        CharacterSessions: { get: jest.fn() },
        RoomAssets: { get: jest.fn() },
        Global: { get: jest.fn() },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { applyCharacterMembershipFlat } from './applyCharacterMembershipFlat'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

const characterMeta: CharacterMetaItem = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: FROM_ROOM,
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    HomeId: 'ROOM#VORTEX',
    assets: ['primitives', 'TownCenter'],
    fileURL: undefined,
    Color: undefined,
}

describe('applyCharacterMembershipFlat', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const readMembershipEndpoint = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        readMembershipEndpoint.mockResolvedValue(FROM_ROOM)
        transactWrite.mockResolvedValue(undefined)
    })

    it('returns changed false without transact when endpoint is unchanged', async () => {
        const result = await applyCharacterMembershipFlat(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM },
            {
                readMembershipEndpoint,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
            }
        )

        expect(result).toEqual({
            ok: true,
            from: FROM_ROOM,
            to: FROM_ROOM,
            changed: false,
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('returns changed false without transact when disconnecting from out of play', async () => {
        readMembershipEndpoint.mockResolvedValue(null)

        const result = await applyCharacterMembershipFlat(
            { characterId: CHARACTER_ID, targetRoomId: null },
            {
                readMembershipEndpoint,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
            }
        )

        expect(result).toEqual({
            ok: true,
            from: null,
            to: null,
            changed: false,
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('cross-room navigate transacts character, departure, and arrival updates', async () => {
        readMembershipEndpoint.mockResolvedValue(FROM_ROOM)

        const result = await applyCharacterMembershipFlat(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            {
                readMembershipEndpoint,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
                getCharacterSessions: async () => ['abcdef'],
                getRoomAssets: async () => ['ASSET#TownCenter'],
                getCanonAssets: async () => ['primitives', 'TownCenter'],
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.changed).toBe(true)
        expect(result.from).toBe(FROM_ROOM)
        expect(result.to).toBe(TO_ROOM)
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(3)
        expect(items[0].Update.Key.EphemeraId).toBe(CHARACTER_ID)
        expect(items[1].Update.Key.EphemeraId).toBe(FROM_ROOM)
        expect(items[2].Update.Key.EphemeraId).toBe(TO_ROOM)

        const characterDraft = produce(
            { RoomId: 'VORTEX', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] },
            items[0].Update.updateReducer
        )
        expect(characterDraft).toEqual({
            RoomId: 'TestTwo',
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
            ],
        })
    })

    it('disconnect clears character RoomId and removes roster entry', async () => {
        readMembershipEndpoint.mockResolvedValue(FROM_ROOM)
        transactWrite.mockImplementation(async (items) => {
            items.forEach((item: { Update?: { Key: { EphemeraId: string }; successCallback?: (output: unknown) => void; updateReducer: (draft: unknown) => void } }) => {
                if (!item.Update) {
                    return
                }
                const draft: Record<string, unknown> = item.Update.Key.EphemeraId === FROM_ROOM
                    ? { activeCharacters: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }] }
                    : { RoomId: 'VORTEX' }
                item.Update.updateReducer(draft)
                item.Update.successCallback?.(draft)
            })
        })

        const result = await applyCharacterMembershipFlat(
            { characterId: CHARACTER_ID, targetRoomId: null },
            {
                readMembershipEndpoint,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            from: FROM_ROOM,
            to: null,
            changed: true,
        }))
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(2)
        expect(items[0].Update.Key.EphemeraId).toBe(CHARACTER_ID)
        expect(items[1].Update.Key.EphemeraId).toBe(FROM_ROOM)

        const characterDraft = produce({ RoomId: 'VORTEX' }, items[0].Update.updateReducer)
        expect(characterDraft.RoomId).toBeUndefined()
    })
})
