/**
 * ludicCachePersistence Slice 4 payoff, at the observable output: what a player's command resolves.
 * A command resolves a nested object by name from the room's stored row with zero graph reads; the
 * object is moved (a kernel commit bumps the room's marker); the next command resolves it in its new
 * place, through a rebuild. The real consumer (`getRoomObjectCatalogForCharacter`) and the real
 * `readLudicCacheWithOutcome` run; only the leaves are in memory (the two rows, the fresh graph read,
 * the Canon stack, the names), so the assertion is on the resolved referent, never on the row.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { parentRemainderKey, testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { readLudicCacheWithOutcome, type LudicCacheRow } from '../positions/ludicCache/store'
import { getRoomObjectCatalogForCharacter } from './roomObjectCatalogForCharacter'

const characterId = 'CHARACTER#Test' as EphemeraCharacterId
const roomId = 'ROOM#Kitchen' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const cupId = 'OBJECT#Cup' as EphemeraObjectId
const tableBinding = PresenceKey('table-in-kitchen')

const graphsBeforeMove = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [roomId, testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] })],
    [tableId, testLudicGraph(tableId, {
        nodes: [
            { tag: 'Object', universalKey: cupId },
            { tag: 'Presence', universalKey: tableBinding, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, cover: { members: [{ tag: 'Remainder' }] } },
        ],
    })],
    [cupId, testLudicGraph(cupId, { nodes: [{ tag: 'Object', universalKey: cupId }] })],
])

/** The cup picked off the table and put on the floor. */
const graphsAfterMove = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [roomId, testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }, { tag: 'Object', universalKey: cupId }] })],
    [tableId, testLudicGraph(tableId, {
        nodes: [
            { tag: 'Presence', universalKey: tableBinding, fromHostPresence: { host: roomId, presence: parentRemainderKey(roomId) }, cover: { members: [{ tag: 'Remainder' }] } },
        ],
    })],
    [cupId, testLudicGraph(cupId, { nodes: [{ tag: 'Object', universalKey: cupId }] })],
])

const names: Record<string, string> = { [tableId]: 'Table', [cupId]: 'Cup' }
const getComponentAggregate = async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => (
    names[perspective.universalKey]
        ? [mergedComponentResult({
            universalKey: perspective.universalKey as EphemeraObjectId,
            merged: new StandardObject({ tag: 'Object', shortName: names[perspective.universalKey] }),
            mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
        })]
        : []
)

describe('a player command resolving a nested object from the stored cache', () => {
    it('resolves it from a stored hit with no graph reads, then in its new place once the move marks the room stale', async () => {
        let graphs = graphsBeforeMove()
        const state: { version: number; row?: { builtAtVersion: number; cache: LudicCacheRow['cache'] } } = { version: 1 }
        const getFreshLudicGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) as EphemeraLudicGraph)
        const outcomes: string[] = []
        const catalog = () => getRoomObjectCatalogForCharacter(characterId, {
            getMembershipContainers: async () => [roomId],
            readLudicCache: async (id) => {
                const read = await readLudicCacheWithOutcome(id, {
                    readRows: async () => ({ version: state.version, row: state.row && JSON.parse(JSON.stringify(state.row)) }),
                    writeRow: async (row) => {
                        state.row = JSON.parse(JSON.stringify({ builtAtVersion: row.builtAtVersion, cache: row.cache }))
                        return true
                    },
                    getFreshLudicGraph,
                    resolveCanonStack: async () => ['ASSET#canon'],
                    clearNameMemos: () => {},
                    buildDeps: { getComponentAggregate },
                    runSingleFlight: async ({ computation }) => computation(),
                })
                outcomes.push(read.outcome)
                return read
            },
        })
        const cupEntry = (entries: Awaited<ReturnType<typeof catalog>>['entries']) => entries.find(({ objectId }) => objectId === cupId)
        const log = jest.spyOn(console, 'log').mockImplementation(() => {})

        // First command: no row yet, so the room is rebuilt (and written); the cup resolves on the table.
        expect(cupEntry((await catalog()).entries)).toEqual({ objectId: cupId, normalizedShortName: 'cup', presence: [{ host: tableId, presence: tableBinding }] })
        const readsToBuild = getFreshLudicGraph.mock.calls.length
        expect(readsToBuild).toBeGreaterThan(0)

        // Second command: a stored hit. The same referent, and not one graph read more.
        expect(cupEntry((await catalog()).entries)?.presence).toEqual([{ host: tableId, presence: tableBinding }])
        expect(getFreshLudicGraph).toHaveBeenCalledTimes(readsToBuild)

        // The cup moves: the commit rewrites the graphs and bumps the room's marker in its own transaction.
        graphs = graphsAfterMove()
        state.version += 1

        // Next command: the row is stale, rebuilt, and the cup resolves in its new place.
        expect(cupEntry((await catalog()).entries)).toEqual({ objectId: cupId, normalizedShortName: 'cup', presence: [roomId] })
        expect(outcomes).toEqual(['absent', 'hit', 'stale'])
        log.mockRestore()
    })
})
