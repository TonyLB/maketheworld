import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
            getPositionGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        },
    },
}))

import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import { testPositionGraph } from '../positionGraph/testFixtures'
import type { MembershipDiff, ObjectMembershipApplyArgs } from './types'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const ROOM_B = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId

type PersistObjectDeps = {
    getMembershipContainers: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
} & ApplyHostEffectsDependencies

const persistObjectRoomGraphViaKernel = async (
    args: ObjectMembershipApplyArgs,
    deps: PersistObjectDeps
) => {
    const priorContainers = await deps.getMembershipContainers(args.objectId)
    const plan = planMembershipTransfer({
        entityId: args.objectId,
        entityKind: 'object',
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
            errorCode: 'OBJECT_MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true as const, persisted: false, diff }
    }

    const postApplyRoomGraphs = kernelResult.postApplyGraphs.reduce<
        Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>>
    >((result, graph) => {
        if (isEphemeraRoomId(graph.hostId)) {
            result[graph.hostId] = graph.toStored()
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

describe('object room membership persist (adapter + kernel)', () => {
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

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: ROOM_A },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({
            ok: true,
            persisted: false,
            diff: { froms: [], to: ROOM_A, changed: false },
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('returns persisted false without transact when removing from out of play', async () => {
        getMembershipContainers.mockResolvedValue([])

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: null },
            { getMembershipContainers, transactWrite }
        )

        expect(result).toEqual({
            ok: true,
            persisted: false,
            diff: { froms: [], to: null, changed: false },
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('places object in room with graph update and adjacency put', async () => {
        getMembershipContainers.mockResolvedValue([])
        const getPositionGraph = jest.fn().mockResolvedValue(testPositionGraph(ROOM_A))

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: ROOM_A },
            { getMembershipContainers, transactWrite, getPositionGraph }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [], to: ROOM_A, changed: true },
            postApplyRoomGraphs: {
                [ROOM_A]: {
                    nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
                },
            },
        }))

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(2)
        expect(items[0].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[1].Put).toEqual({
            EphemeraId: OBJECT_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
    })

    it('cross-room move transacts graph remove, adjacency delete, graph add, adjacency put', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])
        const getPositionGraph = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => {
            if (roomId === ROOM_A) {
                return testPositionGraph(ROOM_A, {
                    nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
                })
            }
            return testPositionGraph(roomId)
        })

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: ROOM_B },
            { getMembershipContainers, transactWrite, getPositionGraph }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: ROOM_B, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(4)
        expect(items[0].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[1].Delete).toEqual({
            EphemeraId: OBJECT_ID,
            DataCategory: buildPositionAdjacencyDataCategory(ROOM_A),
        })
        expect(items[2].Update.Key.EphemeraId).toBe(ROOM_B)
        expect(items[3].Put.DataCategory).toBe(buildPositionAdjacencyDataCategory(ROOM_B))

        const departureDraft = produce(
            {
                positionGraph: {
                    nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
                    edges: [],
                },
            },
            items[0].Update.updateReducer
        ) as { positionGraph?: { nodes: unknown[] } }
        expect(departureDraft.positionGraph?.nodes).toEqual([])
    })

    it('remove from room deletes graph node and adjacency without target put', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A])
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(ROOM_A, {
                nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
            })
        )

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: null },
            { getMembershipContainers, transactWrite, getPositionGraph }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A], to: null, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        expect(items).toHaveLength(2)
        expect(items[0].Update.Key.EphemeraId).toBe(ROOM_A)
        expect(items[1].Delete.DataCategory).toBe(buildPositionAdjacencyDataCategory(ROOM_A))
    })

    it('drift scrub [A,C] -> B removes from both prior hosts', async () => {
        getMembershipContainers.mockResolvedValue([ROOM_A, ROOM_C])
        const getPositionGraph = jest.fn().mockImplementation(async (roomId: EphemeraRoomId) => {
            if (roomId === ROOM_A || roomId === ROOM_C) {
                return testPositionGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
                })
            }
            return testPositionGraph(roomId)
        })

        const result = await persistObjectRoomGraphViaKernel(
            { objectId: OBJECT_ID, targetRoomId: ROOM_B },
            { getMembershipContainers, transactWrite, getPositionGraph }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            persisted: true,
            diff: { froms: [ROOM_A, ROOM_C], to: ROOM_B, changed: true },
        }))

        const items = transactWrite.mock.calls[0][0]
        const deleteCategories = items
            .filter((item: { Delete?: { DataCategory: string } }) => item.Delete)
            .map((item: { Delete: { DataCategory: string } }) => item.Delete.DataCategory)
        expect(deleteCategories).toEqual([
            buildPositionAdjacencyDataCategory(ROOM_A),
            buildPositionAdjacencyDataCategory(ROOM_C),
        ])
    })
})
