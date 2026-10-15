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

    it('lists the characters the row holds', async () => {
        expect(await readRoomCharacters(R1, rows({ [ALPHA]: ['PRESENCE#a1'], [BETA]: [] }))).toEqual([ALPHA, BETA])
    })

    it('an absent row is an empty room (the first arrival creates it): nothing is rebuilt', async () => {
        expect(await readRoomCharacters(R1, rows(undefined))).toEqual([])
    })

    it('ignores the row\'s key attributes', async () => {
        expect(await readRoomCharacters(R1, rows({ EphemeraId: R1, DataCategory: LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, [ALPHA]: ['PRESENCE#a1'] }))).toEqual([ALPHA])
    })
})
