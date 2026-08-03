import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PerspectivePointerEntry } from '../renderCache/perspectivePointer'
import type { StateChangedPayload } from '../state/events'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    assetStackForPointerOnlyPerspective,
    fanOutStateChangedToPassiveRenders,
    filterRoomCanonStackByCharacterAssets,
    filterRoomCanonStackByRequiredAssetIds,
    groupCharacterRowsByPerspective,
    type CharacterPerspectiveRow,
} from './fanOutStateChangedToPassiveRenders'

const A = 'ASSET#a' as AssetUUID
const B = 'ASSET#b' as AssetUUID
const C = 'ASSET#c' as AssetUUID

describe('fanOutStateChangedToPassiveRenders', () => {
    describe('filterRoomCanonStackByCharacterAssets', () => {
        it('preserves room order and keeps Canon or character assets', () => {
            expect(filterRoomCanonStackByCharacterAssets([C, A, B], [B, A, 'draft[x]'], [A])).toEqual([A, B])
            expect(filterRoomCanonStackByCharacterAssets([C, A, B], [B], [A])).toEqual([A, B])
        })

        it('keeps Canon assets even when there is no overlap with character assets', () => {
            expect(filterRoomCanonStackByCharacterAssets([A, B], ['ASSET#other'], [A])).toEqual([A])
        })

        it('matches character slugs to room stack via AssetKey', () => {
            expect(filterRoomCanonStackByCharacterAssets([A, B, C], ['a', 'b'], [A])).toEqual([A, B])
        })
    })

    describe('filterRoomCanonStackByRequiredAssetIds', () => {
        it('preserves room order among required assets', () => {
            expect(filterRoomCanonStackByRequiredAssetIds([C, A, B], [B, A])).toEqual([A, B])
        })
    })

    describe('assetStackForPointerOnlyPerspective', () => {
        it('returns stack when cache matcher and key agree', async () => {
            const pk = computePerspectiveKey([A, B])
            const getCacheRecordById = jest.fn().mockResolvedValue({
                perspectiveMatcher: { requiredAssetIds: [A, B] },
            })
            const stack = await assetStackForPointerOnlyPerspective(
                'ROOM#x' as EphemeraRoomId,
                pk,
                'CACHE#1' as any,
                [A, B, C],
                getCacheRecordById,
                computePerspectiveKey
            )
            expect(stack).toEqual([A, B])
        })

        it('returns undefined when derived key does not match meta key', async () => {
            const getCacheRecordById = jest.fn().mockResolvedValue({
                perspectiveMatcher: { requiredAssetIds: [A] },
            })
            const stack = await assetStackForPointerOnlyPerspective(
                'ROOM#x' as EphemeraRoomId,
                'PERSPECTIVE#v1#wrong',
                'CACHE#1' as any,
                [A, B, C],
                getCacheRecordById,
                computePerspectiveKey
            )
            expect(stack).toBeUndefined()
        })
    })

    describe('groupCharacterRowsByPerspective', () => {
        it('merges characters that share the same filtered stack', () => {
            const rows: CharacterPerspectiveRow[] = [
                { characterId: 'CHARACTER#1' as EphemeraCharacterId, filteredAssetStack: [A, B] },
                { characterId: 'CHARACTER#2' as EphemeraCharacterId, filteredAssetStack: [A, B] },
            ]
            const groups = groupCharacterRowsByPerspective(rows)
            // groupCharacterRowsByPerspective returns a Record, not a Map (no .size on plain objects)
            expect(Object.keys(groups)).toHaveLength(1)
            const only = Object.values(groups)[0]
            expect(only.assetStack).toEqual([A, B])
            expect(only.characterIds.sort()).toEqual(['CHARACTER#1', 'CHARACTER#2'].sort())
        })

        it('splits characters with different filtered stacks', () => {
            const rows: CharacterPerspectiveRow[] = [
                { characterId: 'CHARACTER#1' as EphemeraCharacterId, filteredAssetStack: [A, B] },
                { characterId: 'CHARACTER#2' as EphemeraCharacterId, filteredAssetStack: [A] },
            ]
            const groups = groupCharacterRowsByPerspective(rows)
            const keys = Object.keys(groups)
            expect(keys).toHaveLength(2)
            expect(keys).toContain(computePerspectiveKey([A, B]))
            expect(keys).toContain(computePerspectiveKey([A]))
        })
    })

    const baseStateChanged = (): StateChangedPayload => ({
        type: 'State Changed',
        componentId: 'ROOM#fanout' as EphemeraRoomId,
        incomingMarkState: { markValue: [{ mark: 'M', value: 'x' }] },
        priorState: { marks: { markValue: [] } },
        newState: { marks: { markValue: [{ mark: 'M', value: 'x' }] } },
    })

    const baseMetaRoom = (roomId: EphemeraRoomId): EphemeraMetaRoom => ({
        EphemeraId: roomId,
        DataCategory: 'Meta::Room',
        state: { marks: { markValue: [] } },
    })

    const makeCollectPointers = (
        map: Record<string, EphemeraCacheId> = {}
    ): ((roomId: EphemeraRoomId) => Promise<PerspectivePointerEntry[]>) => (
        async () => Object.entries(map).map(([perspectiveKey, cacheId]) => ({ perspectiveKey, cacheId }))
    )

    const collectPointersFromMeta = makeCollectPointers()

    it('calls orchestrate once per perspective group with targets and merged getMetaRoom', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A, B, C])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest
            .fn()
            .mockResolvedValueOnce({ assets: [B] })
            .mockResolvedValueOnce({ assets: [C] })
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))

        const messageBus = { send: jest.fn() } as any
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, streamEvent },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
                collectPerspectivePointerEntries: collectPointersFromMeta,
            }
        )

        expect(resolveCanonAssetStackForRoom).toHaveBeenCalledWith(
            'ROOM#fanout',
            expect.objectContaining({
                RoomAssets: expect.anything(),
                AssetMetaData: expect.anything(),
            })
        )
        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(2)

        const first = orchestrateRenderRequestFn.mock.calls[0][0]
        expect(first.payload).toMatchObject({
            type: 'RenderRequested',
            componentId: 'ROOM#fanout',
            perspective: { assetStack: [A, B] },
            targets: ['CHARACTER#1'],
        })
        expect(first.payload.characterId).toBeUndefined()

        const second = orchestrateRenderRequestFn.mock.calls[1][0]
        expect(second.payload).toMatchObject({
            type: 'RenderRequested',
            perspective: { assetStack: [A, C] },
            targets: ['CHARACTER#2'],
        })

        const depsFirst = orchestrateRenderRequestFn.mock.calls[0][1]
        const merged = await depsFirst.getMetaRoom('ROOM#fanout')
        expect(merged?.state).toEqual(stateChanged.newState)
        expect(getMetaRoomBase).toHaveBeenCalled()
    })

    it('dedupes two characters into one orchestrate call when perspectives match', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A, B])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A, B])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest.fn().mockResolvedValue({ assets: [A, B, C] })
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))
        const messageBus = { send: jest.fn() } as any
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, streamEvent },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
                collectPerspectivePointerEntries: collectPointersFromMeta,
            }
        )

        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(1)
        expect(orchestrateRenderRequestFn.mock.calls[0][0].payload).toMatchObject({
            perspective: { assetStack: [A, B] },
            targets: ['CHARACTER#1', 'CHARACTER#2'],
        })
    })

    it('no-op when every character has empty filtered stack and no meta pointers', async () => {
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
        ])
        const characterMetaGet = jest.fn().mockResolvedValue({ assets: ['ASSET#unrelated'] })
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))

        await fanOutStateChangedToPassiveRenders(
            {
                stateChanged: baseStateChanged(),
                streamEvent: jest.fn().mockResolvedValue(undefined),
            },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
                collectPerspectivePointerEntries: collectPointersFromMeta,
            }
        )

        expect(orchestrateRenderRequestFn).not.toHaveBeenCalled()
    })

    it('fans out pointer-only perspectives with allowGeneration false when no audience', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A, B, C])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A])
        const roomCharacterListGet = jest.fn().mockResolvedValue([])
        const pkAb = computePerspectiveKey([A, B])
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))
        const getCacheRecordById = jest.fn().mockResolvedValue({
            perspectiveMatcher: { requiredAssetIds: [A, B] },
        })
        const messageBus = { send: jest.fn() } as any
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, streamEvent },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                getMetaRoomBase,
                getCacheRecordById,
                collectPerspectivePointerEntries: makeCollectPointers({ [pkAb]: 'CACHE#ab' }),
            }
        )

        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(1)
        expect(orchestrateRenderRequestFn.mock.calls[0][0].payload).toMatchObject({
            type: 'RenderRequested',
            perspective: { assetStack: [A, B] },
            targets: [],
            allowGeneration: false,
        })
        expect(getCacheRecordById).toHaveBeenCalledWith('ROOM#fanout', 'CACHE#ab')
    })

    it('does not duplicate orchestrate when meta pointer key matches audience perspective', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A, B])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A, B])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest.fn().mockResolvedValue({ assets: [A, B, C] })
        const pkAb = computePerspectiveKey([A, B])
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))
        const getCacheRecordById = jest.fn()
        const messageBus = { send: jest.fn() } as any
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, streamEvent },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
                getCacheRecordById,
                collectPerspectivePointerEntries: makeCollectPointers({ [pkAb]: 'CACHE#overlap' }),
            }
        )

        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(1)
        expect(orchestrateRenderRequestFn.mock.calls[0][0].payload).toMatchObject({
            targets: ['CHARACTER#1', 'CHARACTER#2'],
        })
        expect(orchestrateRenderRequestFn.mock.calls[0][0].payload.allowGeneration).toBeUndefined()
        expect(getCacheRecordById).not.toHaveBeenCalled()
    })

    it('fans out audience perspectives and an extra pointer-only perspective', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveRoomAssetStackForRoom = jest.fn().mockResolvedValue([A, B, C])
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest
            .fn()
            .mockResolvedValueOnce({ assets: [A, B] })
            .mockResolvedValueOnce({ assets: [A] })
        const pkAb = computePerspectiveKey([A, B])
        const pkA = computePerspectiveKey([A])
        const pkBc = computePerspectiveKey([B, C])
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))
        const getCacheRecordById = jest.fn().mockImplementation(async (_room: EphemeraRoomId, cacheId: string) => {
            if (cacheId === 'CACHE#bc') {
                return { perspectiveMatcher: { requiredAssetIds: [B, C] } }
            }
            return undefined
        })
        const messageBus = { send: jest.fn() } as any
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, streamEvent },
            {
                orchestrateRenderRequestFn,
                resolveRoomAssetStackForRoom,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
                getCacheRecordById,
                collectPerspectivePointerEntries: makeCollectPointers({
                    [pkAb]: 'CACHE#ab',
                    [pkA]: 'CACHE#a',
                    [pkBc]: 'CACHE#bc',
                }),
            }
        )

        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(3)
        const payloads = orchestrateRenderRequestFn.mock.calls.map((c) => c[0].payload)
        const withDefer = payloads.filter((p: { allowGeneration?: boolean }) => p.allowGeneration === false)
        const withoutDefer = payloads.filter((p: { allowGeneration?: boolean }) => p.allowGeneration !== false)
        expect(withDefer).toHaveLength(1)
        expect(withoutDefer).toHaveLength(2)
        expect(withDefer[0]).toMatchObject({
            perspective: { assetStack: [B, C] },
            targets: [],
        })
        expect(getCacheRecordById).toHaveBeenCalledTimes(1)
        expect(getCacheRecordById).toHaveBeenCalledWith('ROOM#fanout', 'CACHE#bc')
    })
})
