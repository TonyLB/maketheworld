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
        Positions: {
            getMembershipContainers: jest.fn(),
            getPositionGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        },
        ComponentEphemeraMeta: { get: jest.fn() },
    },
}))

import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { computeMembershipDiff } from '../manipulation/adapters/computeEndStateRoomDiff'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import type { MembershipApplyArgs, MembershipDiff } from './types'

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

const characterPresentGraph = {
    nodes: [{ tag: 'Character' as const, universalKey: CHARACTER_ID }],
    edges: [] as [],
}

const emptyGraph = { nodes: [], edges: [] as [] }

const getPositionGraphForCharacterRooms = async (
    hostId: EphemeraMembershipHostId,
    presentOn: EphemeraRoomId[]
) => (isEphemeraRoomId(hostId) && presentOn.includes(hostId) ? characterPresentGraph : emptyGraph)

type PersistCharacterDeps = {
    getCharacterMeta?: () => Promise<CharacterMetaItem>;
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
} & ApplyHostEffectsDependencies

const persistCharacterRoomGraphViaKernel = async (
    args: MembershipApplyArgs,
    deps: PersistCharacterDeps
) => {
    const priorContainers = await deps.getMembershipContainers(args.characterId)
    const plan = planMembershipTransfer({
        entityId: args.characterId,
        entityKind: 'character',
        applyMode: 'end-state',
        target: args.targetRoomId,
        priorContainers,
    })

    const diff: MembershipDiff = {
        froms: plan.projection.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
        to: plan.projection.to !== null && isEphemeraRoomId(plan.projection.to) ? plan.projection.to : null,
        changed: plan.projection.changed,
    }

    if (!diff.changed) {
        return { ok: true as const, persisted: false, diff }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects },
        deps
    )

    if (!kernelResult.ok) {
        return {
            ok: false as const,
            errorCode: 'MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true as const, persisted: false, diff }
    }

    const postApplyRoomGraphs = Object.entries(kernelResult.postApplyGraphs).reduce<
        Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>>
    >((result, [hostId, graph]) => {
        if (isEphemeraRoomId(hostId)) {
            result[hostId] = graph
        }
        return result
    }, {})

    return {
        ok: true as const,
        persisted: true,
        diff,
        postApplyRoomGraphs,
    }
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

describe('character membership persist (adapter + kernel)', () => {
    const transactWrite = ephemeraDB.transactWrite as jest.Mock
    const exponentialBackoffWrapperMock = exponentialBackoffWrapper as jest.MockedFunction<typeof exponentialBackoffWrapper>
    const getMembershipContainers = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        transactWrite.mockResolvedValue(undefined)
        exponentialBackoffWrapperMock.mockImplementation(async (fn) => fn())
    })

    it('returns persisted false without transact when endpoint is unchanged', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        const result = await persistCharacterRoomGraphViaKernel(
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

        const result = await persistCharacterRoomGraphViaKernel(
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

    it('cross-room navigate transacts graph and adjacency without priorFetch', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])
        const getPositionGraph = jest.fn().mockImplementation(
            async (hostId: EphemeraMembershipHostId) => getPositionGraphForCharacterRooms(hostId, [ROOM_A])
        )

        const result = await persistCharacterRoomGraphViaKernel(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_B },
            {
                getMembershipContainers,
                transactWrite,
                getPositionGraph,
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: ROOM_B, changed: true },
            postApplyRoomGraphs: {
                [ROOM_A]: { nodes: [] },
                [ROOM_B]: {
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }],
                },
            },
        }))
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(4)
        expect(items[0].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[0].Update.updateKeys).toEqual(['positionGraph'])
        expect(items[0].Update.successCallback).toBeUndefined()
        expect(items[0].Update.priorFetch).toBeUndefined()
        expect(items[1].Delete).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
        expect(items[2].Update.Key.EphemeraId).toBe(ROOM_B)
        expect(items[2].Update.priorFetch).toBeUndefined()
        expect(items[3].Put).toEqual({
            EphemeraId: CHARACTER_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_B),
        })

        const departureDraft = produce(
            {
                positionGraph: {
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }],
                    edges: [],
                },
            },
            items[0].Update.updateReducer
        ) as { positionGraph?: { nodes: unknown[]; edges: unknown[] } }
        expect(departureDraft.positionGraph).toEqual({ nodes: [], edges: [] })
    })

    it('disconnect removes graph membership and adjacency without character-row transact', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])
        const getPositionGraph = jest.fn().mockImplementation(
            async (hostId: EphemeraMembershipHostId) => getPositionGraphForCharacterRooms(hostId, [ROOM_A])
        )

        const result = await persistCharacterRoomGraphViaKernel(
            { characterId: CHARACTER_ID, targetRoomId: null },
            {
                getMembershipContainers,
                transactWrite,
                getCharacterMeta: async () => characterMeta,
                getPositionGraph,
            }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: null, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(2)
        expect(items[0].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[0].Update.priorFetch).toBeUndefined()
        expect(items[0].Update.successCallback).toBeUndefined()
        expect(items[1].Delete.DataCategory).toBe(buildPositionAdjacencyDataCategory(ROOM_A))
    })

    it('drift scrub [A,C] -> B removes from both prior hosts', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A, ROOM_C])
        const getPositionGraph = jest.fn().mockImplementation(
            async (hostId: EphemeraMembershipHostId) => getPositionGraphForCharacterRooms(hostId, [ROOM_A, ROOM_C])
        )

        const result = await persistCharacterRoomGraphViaKernel(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_B },
            {
                getMembershipContainers,
                transactWrite,
                getPositionGraph,
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

    it('rebuilds transact items on each exponentialBackoffWrapper retry', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])

        let attempt = 0
        transactWrite.mockImplementation(async () => {
            attempt += 1
            if (attempt === 1) {
                throw new Error('TransactionCanceledException')
            }
        })

        exponentialBackoffWrapperMock.mockImplementation(async (fn, options) => {
            try {
                await fn()
            }
            catch (error) {
                if (options?.retryErrors?.includes('TransactionCanceledException')) {
                    await fn()
                    return
                }
                throw error
            }
        })

        await persistCharacterRoomGraphViaKernel(
            { characterId: CHARACTER_ID, targetRoomId: ROOM_B },
            {
                getMembershipContainers,
                transactWrite,
                getPositionGraph: async (hostId: EphemeraMembershipHostId) =>
                    getPositionGraphForCharacterRooms(hostId, [ROOM_A]),
            }
        )

        expect(transactWrite).toHaveBeenCalledTimes(2)
        expect(transactWrite.mock.calls[0][0][0].Update.priorFetch).toBeUndefined()
        expect(transactWrite.mock.calls[1][0][0].Update.priorFetch).toBeUndefined()

        const secondAttemptDraft = produce(
            {
                positionGraph: {
                    nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }],
                    edges: [],
                },
            },
            transactWrite.mock.calls[1][0][0].Update.updateReducer
        ) as { positionGraph?: { nodes: unknown[]; edges: unknown[] } }
        expect(secondAttemptDraft.positionGraph).toEqual({ nodes: [], edges: [] })
    })
})
