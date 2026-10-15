jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../internalCache', () => ({ __esModule: true, default: {} }))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../ludicGraph/testFixtures'
import type { MembershipChange } from '../manipulation/kernel/membershipChanges'
import {
    LUDIC_CACHE_CHARACTERS_DATA_CATEGORY,
    bindingIdsInto,
    charactersRowItemsFor,
    readRoomCharacters,
    rebuildCharactersRow,
} from './charactersRow'

const R1 = 'ROOM#Cafe' as EphemeraRoomId
const R2 = 'ROOM#Terrace' as EphemeraRoomId
const ALPHA = 'CHARACTER#Alpha' as EphemeraCharacterId
const BETA = 'CHARACTER#Beta' as EphemeraCharacterId
const CUP = 'OBJECT#Cup' as EphemeraObjectId

const characterGraph = (id: EphemeraCharacterId, ...bindings: [string, EphemeraMembershipHostId | undefined][]) => (
    testLudicGraph(id as any, { nodes: bindings.map(([name, host]) => presenceBindingNode(name, host)) })
)
const roomGraph = (id: EphemeraRoomId, ...characters: EphemeraCharacterId[]) => testLudicGraph(id, {
    nodes: [{ tag: 'Room', universalKey: id }, ...characters.map((universalKey) => ({ tag: 'Character' as const, universalKey })), presenceBindingNode(parentRemainderKey(id))],
})
const graphsOf = (...graphs: EphemeraLudicGraph[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(graphs.map((graph) => [graph.hostId, graph]))
const change = (entityId: EphemeraMembershipHostId, left: EphemeraMembershipHostId[], arrived: EphemeraMembershipHostId[]): MembershipChange => ({ entityId, left, arrived, anchor: 0 })

describe('bindingIdsInto', () => {
    it('lists only the bindings that point at the room', () => {
        const graph = characterGraph(ALPHA, ['a1', R1], ['a2', R2], ['a3', undefined])
        expect(bindingIdsInto(graph, R1)).toEqual(['PRESENCE#a1'])
    })
})

describe('charactersRowItemsFor', () => {
    it('removes a character from a room it left and sets it, with its binding ids, in the room it arrived at', () => {
        expect(charactersRowItemsFor(
            [change(ALPHA, [R1], [R2])],
            graphsOf(characterGraph(ALPHA, ['a1', R2]))
        )).toEqual([
            { PrimitiveUpdate: { Key: { EphemeraId: R1, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY }, ProjectionFields: [], UpdateExpression: 'REMOVE #r0', ExpressionAttributeNames: { '#r0': ALPHA } } },
            { PrimitiveUpdate: { Key: { EphemeraId: R2, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY }, ProjectionFields: [], UpdateExpression: 'SET #c0 = :b0', ExpressionAttributeNames: { '#c0': ALPHA }, ExpressionAttributeValues: { ':b0': ['PRESENCE#a1'] } } },
        ])
    })

    it('a connect only sets, and a disconnect only removes', () => {
        const connect = charactersRowItemsFor([change(ALPHA, [], [R1])], graphsOf(characterGraph(ALPHA, ['a1', R1])))
        expect(connect.map(({ PrimitiveUpdate }) => PrimitiveUpdate.UpdateExpression)).toEqual(['SET #c0 = :b0'])
        const disconnect = charactersRowItemsFor([change(ALPHA, [R1], [])], graphsOf(characterGraph(ALPHA, ['a1', undefined])))
        expect(disconnect.map(({ PrimitiveUpdate }) => PrimitiveUpdate.UpdateExpression)).toEqual(['REMOVE #r0'])
    })

    it('combines two characters through one room into one item for it', () => {
        const items = charactersRowItemsFor(
            [change(ALPHA, [], [R1]), change(BETA, [R1], [])],
            graphsOf(characterGraph(ALPHA, ['a1', R1]), characterGraph(BETA, ['b1', undefined]))
        )
        expect(items).toHaveLength(1)
        expect(items[0].PrimitiveUpdate.UpdateExpression).toBe('SET #c0 = :b0 REMOVE #r0')
        expect(items[0].PrimitiveUpdate.ExpressionAttributeNames).toEqual({ '#c0': ALPHA, '#r0': BETA })
    })

    it('ignores movers that are not characters and hosts that are not rooms', () => {
        expect(charactersRowItemsFor(
            [change(CUP, [R1], [R2]), change(ALPHA, ['OBJECT#Table' as any], ['FEATURE#Door' as any])],
            graphsOf(characterGraph(ALPHA, ['a1', 'OBJECT#Table' as any]))
        )).toEqual([])
    })
})

describe('readRoomCharacters', () => {
    const rows = (row: Record<string, unknown> | undefined) => ({ getRow: jest.fn(async () => row as any) })

    it('reads a complete row without a rebuild', async () => {
        const writeRebuild = jest.fn()
        const getFreshLudicGraph = jest.fn()
        expect(await readRoomCharacters(R1, { ...rows({ complete: true, [ALPHA]: ['PRESENCE#a1'], [BETA]: [] }), writeRebuild, getFreshLudicGraph })).toEqual([ALPHA, BETA])
        expect(writeRebuild).not.toHaveBeenCalled()
        expect(getFreshLudicGraph).not.toHaveBeenCalled()
    })

    it('rebuilds an absent row from the room graph and each character\'s bindings, never answering "nobody here"', async () => {
        const graphs = graphsOf(roomGraph(R1, ALPHA, BETA), characterGraph(ALPHA, ['a1', R1]), characterGraph(BETA, ['b1', R1], ['b2', R2]))
        const writeRebuild = jest.fn(async () => true)
        const getRow = jest.fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ complete: true, [ALPHA]: ['PRESENCE#a1'], [BETA]: ['PRESENCE#b1'] })
        const ids = await readRoomCharacters(R1, { getRow, writeRebuild, getFreshLudicGraph: async (hostId) => graphs.get(hostId)! })
        expect(ids).toEqual([ALPHA, BETA])
        expect(writeRebuild).toHaveBeenCalledWith(R1, new Map([[ALPHA, ['PRESENCE#a1']], [BETA, ['PRESENCE#b1']]]))
    })

    it('treats a partial row (a kernel write beat the rebuild) as incomplete, and returns what the row holds once completed', async () => {
        const graphs = graphsOf(roomGraph(R1, ALPHA, BETA), characterGraph(ALPHA, ['a1', R1]), characterGraph(BETA, ['b1', R1]))
        const getRow = jest.fn()
            .mockResolvedValueOnce({ [ALPHA]: ['PRESENCE#a1'] })
            .mockResolvedValueOnce({ complete: true, [ALPHA]: ['PRESENCE#a1'], [BETA]: ['PRESENCE#b1'] })
        const writeRebuild = jest.fn(async () => true)
        expect(await readRoomCharacters(R1, { getRow, writeRebuild, getFreshLudicGraph: async (hostId) => graphs.get(hostId)! })).toEqual([ALPHA, BETA])
        expect(writeRebuild).toHaveBeenCalledTimes(1)
    })

    it('returns an entry the kernel wrote after the rebuild read the graph (the re-read is of the stored row)', async () => {
        const graphs = graphsOf(roomGraph(R1))
        const getRow = jest.fn().mockResolvedValue({ complete: true, [ALPHA]: ['PRESENCE#a1'] })
        expect(await rebuildCharactersRow(R1, { getRow, writeRebuild: async () => true, getFreshLudicGraph: async (hostId) => graphs.get(hostId)! })).toEqual([ALPHA])
    })

    it('an empty room rebuilds to a complete row with no characters', async () => {
        const graphs = graphsOf(roomGraph(R1))
        const writeRebuild = jest.fn(async () => true)
        const getRow = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ complete: true })
        expect(await readRoomCharacters(R1, { getRow, writeRebuild, getFreshLudicGraph: async (hostId) => graphs.get(hostId)! })).toEqual([])
        expect(writeRebuild).toHaveBeenCalledWith(R1, new Map())
    })
})

describe('the rebuild write', () => {
    const graphs = graphsOf(roomGraph(R1, ALPHA), characterGraph(ALPHA, ['a1', R1]))
    const getFreshLudicGraph = async (hostId: EphemeraMembershipHostId) => graphs.get(hostId)!

    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDB as any).strictPrimitiveUpdate = jest.fn().mockResolvedValue(undefined)
        jest.mocked(ephemeraDB.getItem).mockResolvedValue({ EphemeraId: R1, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, complete: true, [ALPHA]: ['PRESENCE#a1'] } as any)
    })

    it('completes the row with if_not_exists per character, only while it is incomplete, so a concurrent kernel SET survives', async () => {
        expect(await rebuildCharactersRow(R1, { getFreshLudicGraph })).toEqual([ALPHA])
        expect((ephemeraDB as any).strictPrimitiveUpdate).toHaveBeenCalledWith({
            Key: { EphemeraId: R1, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY },
            UpdateExpression: 'SET #complete = :complete, #c0 = if_not_exists(#c0, :b0)',
            ConditionExpression: 'attribute_not_exists(#complete)',
            ExpressionAttributeNames: { '#complete': 'complete', '#c0': ALPHA },
            ExpressionAttributeValues: { ':complete': { BOOL: true }, ':b0': { L: [{ S: 'PRESENCE#a1' }] } },
        })
    })

    it('is not an error when the row was completed first: it reads what is there', async () => {
        ;(ephemeraDB as any).strictPrimitiveUpdate.mockRejectedValue(Object.assign(new Error('refused'), { name: 'ConditionalCheckFailedException' }))
        expect(await rebuildCharactersRow(R1, { getFreshLudicGraph })).toEqual([ALPHA])
    })

    it('throws any other failure rather than answering from an unwritten row', async () => {
        ;(ephemeraDB as any).strictPrimitiveUpdate.mockRejectedValue(new Error('throttled'))
        await expect(rebuildCharactersRow(R1, { getFreshLudicGraph })).rejects.toThrow('throttled')
    })
})
