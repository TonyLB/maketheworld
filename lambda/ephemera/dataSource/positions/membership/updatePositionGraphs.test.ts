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
        Positions: { getMembershipContainers: jest.fn() },
        ComponentEphemeraMeta: { get: jest.fn() },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { computeMembershipDiff, updatePositionGraphs } from './updatePositionGraphs'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId

const characterMeta: CharacterMetaItem = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: ROOM_A,
    RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
    HomeId: ROOM_A,
    assets: ['primitives', 'TownCenter'],
    fileURL: undefined,
    Color: undefined,
}

describe('computeMembershipDiff', () => {
    it('detects no change when already at target', () => {
        expect(computeMembershipDiff([ROOM_A], ROOM_A)).toEqual({
            froms: [],
            to: ROOM_A,
            changed: false,
        })
    })

    it('detects no change when out of play and target null', () => {
        expect(computeMembershipDiff([], null)).toEqual({
            froms: [],
            to: null,
            changed: false,
        })
    })

    it('produces plural froms on drift scrub', () => {
        expect(computeMembershipDiff([ROOM_A, ROOM_C], ROOM_B)).toEqual({
            froms: [ROOM_A, ROOM_C],
            to: ROOM_B,
            changed: true,
        })
    })
})

describe('updatePositionGraphs', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const getMembershipContainers = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
    })

    it('returns persisted false without transact when endpoint is unchanged', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        const result = await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_A },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
            }
        )

        expect(result).toEqual({
            ok: true,
            persisted: false,
            diff: { froms: [], to: ROOM_A, changed: false },
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('returns persisted false without transact when disconnecting from out of play', async () => {
        getMembershipContainers.mockResolvedValue([])

        const result = await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: null },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
            }
        )

        expect(result).toEqual({
            ok: true,
            persisted: false,
            diff: { froms: [], to: null, changed: false },
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('cross-room navigate transacts graph, adjacency, and legacy fields', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        const result = await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_B },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
                getCharacterSessions: async () => ['abcdef'],
                getRoomAssets: async () => ['ASSET#TownCenter'],
                getCanonAssets: async () => ['primitives', 'TownCenter'],
                getMetaRoom: async (roomId) => ({
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room' as const,
                    activeCharacters: roomId === ROOM_A
                        ? [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }]
                        : [],
                }),
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: ROOM_B, changed: true },
        }))
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(5)
        expect(items[0].Update.Key.EphemeraId).toBe(CHARACTER_ID)
        expect(items[1].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[1].Update.updateKeys).toEqual(['positionGraph', 'activeCharacters'])
        expect(items[2].Delete).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
        expect(items[3].Update.Key.EphemeraId).toBe(ROOM_B)
        expect(items[4].Put).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_B),
        })

        const departureDraft = produce(
            {
                activeCharacters: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }],
            },
            items[1].Update.updateReducer
        ) as { activeCharacters: unknown[]; positionGraph?: { nodes: unknown[]; edges: unknown[] } }
        expect(departureDraft.activeCharacters).toEqual([])
        expect(departureDraft.positionGraph).toEqual({ nodes: [], edges: [] })

        const characterDraft = produce(
            {
                RoomId: 'VORTEX',
                RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            },
            items[0].Update.updateReducer
        ) as { RoomId: string; RoomStack: { asset: string; RoomId: string }[] }
        expect(characterDraft).toEqual({
            RoomId: 'TestTwo',
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
            ],
        })
    })

    it('disconnect removes graph membership, adjacency, and RoomId', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])
        transactWrite.mockImplementation(async (items) => {
            items.forEach((item: {
                Update?: {
                    Key: { EphemeraId: string };
                    successCallback?: (output: unknown) => void;
                    updateReducer: (draft: unknown) => void;
                };
            }) => {
                if (!item.Update) {
                    return
                }
                const draft: Record<string, unknown> = item.Update.Key.EphemeraId === ROOM_A
                    ? { activeCharacters: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }] }
                    : { RoomId: 'VORTEX' }
                item.Update.updateReducer(draft)
                item.Update.successCallback?.(draft)
            })
        })

        const result = await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: null },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
                getMetaRoom: async (roomId) => ({
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room' as const,
                    activeCharacters: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }],
                }),
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: null, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(3)
        expect(items[0].Update.Key.EphemeraId).toBe(CHARACTER_ID)
        expect(items[1].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[2].Delete.DataCategory).toBe(buildPositionAdjacencyDataCategory(ROOM_A))
    })

    it('drift scrub [A,C] -> B removes from both prior hosts', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A, ROOM_C])

        const result = await updatePositionGraphs(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_B },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
                getCharacterSessions: async () => [],
                getRoomAssets: async () => [],
                getCanonAssets: async () => ['primitives'],
                getMetaRoom: async (roomId) => ({
                    EphemeraId: roomId,
                    DataCategory: 'Meta::Room' as const,
                    activeCharacters: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test' }],
                }),
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A, ROOM_C], to: ROOM_B, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        const departureRoomIds = items
            .filter((item: { Update?: { Key: { EphemeraId: EphemeraRoomId } } }) =>
                item.Update && [ROOM_A, ROOM_C].includes(item.Update.Key.EphemeraId))
            .map((item: { Update: { Key: { EphemeraId: EphemeraRoomId } } }) => item.Update.Key.EphemeraId)
        expect(departureRoomIds).toEqual([ROOM_A, ROOM_C])

        const deleteCategories = items
            .filter((item: { Delete?: { DataCategory: string } }) => item.Delete)
            .map((item: { Delete: { DataCategory: string } }) => item.Delete.DataCategory)
        expect(deleteCategories).toEqual([
            buildPositionAdjacencyDataCategory(ROOM_A),
            buildPositionAdjacencyDataCategory(ROOM_C),
        ])
    })
})
