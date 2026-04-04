import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StateChangedPayload } from '../state/events'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    fanOutStateChangedToPassiveRenders,
    filterRoomCanonStackByCharacterAssets,
    groupCharacterRowsByPerspective,
    type CharacterPerspectiveRow,
} from './fanOutStateChangedToPassiveRenders'

const A = 'ASSET#a' as AssetUUID
const B = 'ASSET#b' as AssetUUID
const C = 'ASSET#c' as AssetUUID

describe('fanOutStateChangedToPassiveRenders', () => {
    describe('filterRoomCanonStackByCharacterAssets', () => {
        it('preserves room order and keeps only assets present on the character', () => {
            expect(filterRoomCanonStackByCharacterAssets([C, A, B], [B, A, 'draft[x]'])).toEqual([A, B])
            expect(filterRoomCanonStackByCharacterAssets([C, A, B], [B])).toEqual([B])
        })

        it('returns empty when there is no overlap', () => {
            expect(filterRoomCanonStackByCharacterAssets([A, B], ['ASSET#other'])).toEqual([])
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
        currentCacheByPerspective: {},
    })

    it('calls orchestrate once per perspective group with targets and merged getMetaRoom', async () => {
        const stateChanged = baseStateChanged()
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A, B, C])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest
            .fn()
            .mockResolvedValueOnce({ assets: [A, B] })
            .mockResolvedValueOnce({ assets: [A] })
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))

        const messageBus = { send: jest.fn() } as any

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, messageBus },
            {
                orchestrateRenderRequestFn,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
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
            perspective: { assetStack: [A] },
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
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A, B])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
            { EphemeraId: 'CHARACTER#2' as EphemeraCharacterId, DisplayName: 'Two', SessionIds: [] },
        ])
        const characterMetaGet = jest.fn().mockResolvedValue({ assets: [A, B, C] })
        const getMetaRoomBase = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => baseMetaRoom(roomId))
        const messageBus = { send: jest.fn() } as any

        await fanOutStateChangedToPassiveRenders(
            { stateChanged, messageBus },
            {
                orchestrateRenderRequestFn,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
                getMetaRoomBase,
            }
        )

        expect(orchestrateRenderRequestFn).toHaveBeenCalledTimes(1)
        expect(orchestrateRenderRequestFn.mock.calls[0][0].payload).toMatchObject({
            perspective: { assetStack: [A, B] },
            targets: ['CHARACTER#1', 'CHARACTER#2'],
        })
    })

    it('no-op when every character has empty filtered stack', async () => {
        const orchestrateRenderRequestFn = jest.fn().mockResolvedValue(undefined)
        const resolveCanonAssetStackForRoom = jest.fn().mockResolvedValue([A])
        const roomCharacterListGet = jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' as EphemeraCharacterId, DisplayName: 'One', SessionIds: [] },
        ])
        const characterMetaGet = jest.fn().mockResolvedValue({ assets: ['ASSET#unrelated'] })

        await fanOutStateChangedToPassiveRenders(
            { stateChanged: baseStateChanged(), messageBus: { send: jest.fn() } as any },
            {
                orchestrateRenderRequestFn,
                resolveCanonAssetStackForRoom,
                roomCharacterListGet,
                characterMetaGet,
            }
        )

        expect(orchestrateRenderRequestFn).not.toHaveBeenCalled()
    })
})
