/**
 * Payoff, ephemera leg. The diagnostics leg
 * (`lambda/diagnostics/containmentDriftPayoff.test.ts`) proves each shared scenario's drifted rows
 * make the real sweeps emit exactly `expected`, and that the scenario's `healed` rows read silent.
 * This leg proves the real heals turn the drifted rows into those healed rows: each expected finding
 * is serialized with the real `DiagnosticsEventSerializer` (the wire path into this lambda) and
 * published on the real messageBus, where the positions DataSource routes it to the real
 * `healContainmentPopulation` / `healPresenceCover`, the real kernel and the real `MultiKeyUpdate`
 * reducer. Only the DynamoDB leaf (`ephemeraDB.transactWrite`) and the cache reads are in memory. The
 * EventBridge hop itself stays a manual check (repo convention).
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../perception/kickRoomHeaderBroadcast', () => ({
    kickRoomHeaderBroadcastForRoom: jest.fn().mockResolvedValue(undefined),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import {
    containmentDriftScenarios,
    normalizeMintedIds,
    type ContainmentDriftScenario,
    type ScenarioRow,
} from '@tonylb/mtw-gateways/ts/ephemera/positions/containmentDriftScenarios'

import internalCache from '../../../../internalCache'
import messageBus from '../../../../messageBus'
import { EphemeraLudicGraph, graphFromMeta } from '../../ludicGraph'

import '../../index'

const FIXED_FINDING = 'Fixed Containment Drift Finding'
const COVER_FINDING = 'Presence Cover Drift Finding'

let world: Map<string, { row: ScenarioRow; graph: EphemeraLudicGraph }>

// The stored shape the sweeps read carries no `rootId` or `ports`, which the graph requires at its read boundary.
const seed = (rows: ScenarioRow[]) => new Map(rows.map((row) => [
    row.EphemeraId,
    {
        row,
        graph: graphFromMeta({ ...row, ludicGraph: { rootId: row.EphemeraId, ports: [], ...row.ludicGraph } } as unknown as Record<string, unknown>, row.EphemeraId as EphemeraMembershipHostId),
    },
]))

const storedRows = (): ScenarioRow[] => [...world.entries()].map(([EphemeraId, { row, graph }]) => ({
    EphemeraId,
    DataCategory: row.DataCategory,
    ludicGraph: graph.toStored() as unknown as ScenarioRow['ludicGraph'],
}))

/** `transactWrite`'s `MultiKeyUpdate`: fetch the keys, run the reducer, write back. The cascade's marker bumps and characters-row updates are not under test. */
const applyTransact = async (items: any[]): Promise<void> => {
    for (const item of items) {
        const multi = item.MultiKeyUpdate
        if (!multi) {
            throw new Error(`unexpected transact item: ${Object.keys(item).join(',')}`)
        }
        const draft: Record<string, any> = {}
        for (const key of multi.Keys as { EphemeraId: string; DataCategory: string }[]) {
            const entry = world.get(key.EphemeraId)
            if (!entry) {
                throw new Error(`transact: no row for ${key.EphemeraId}`)
            }
            draft[`${key.EphemeraId}#${key.DataCategory}`] = { EphemeraId: key.EphemeraId, DataCategory: key.DataCategory, ludicGraph: entry.graph.toStored() }
        }
        multi.reducer(draft)
        for (const key of multi.Keys as { EphemeraId: string; DataCategory: string }[]) {
            const written = draft[`${key.EphemeraId}#${key.DataCategory}`]
            const entry = world.get(key.EphemeraId)!
            if (written) {
                world.set(key.EphemeraId, { row: entry.row, graph: graphFromMeta(written, key.EphemeraId as EphemeraMembershipHostId) })
            }
        }
    }
}

const authoredAssets = (scenario: ContainmentDriftScenario) => {
    jest.spyOn(internalCache.RoomAssets, 'get').mockImplementation((async (parentId: string) => (
        scenario.authored[parentId] ? ['ASSET#test'] : []
    )) as any)
    jest.spyOn(internalCache.ComponentData, 'getAcrossAssets').mockImplementation((async (parentId: string) => (
        scenario.authored[parentId]
            ? { 'ASSET#test': { component: { ludicGraph: { nodes: { payload: scenario.authored[parentId] } } } } }
            : {}
    )) as any)
}

/** One finding, as the wire carries it: serialized, JSON round-tripped, deserialized, then published for the positions DataSource. */
const deliver = async (type: string, ephemeraId: string): Promise<void> => {
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const header = { dataSourceKey: 'mtw.diagnostics', streamKey: 'global', timestamp: Date.now(), type }
    const wire = serializer.serialize({
        header: header as any,
        content: { type, ephemeraId, diagnosticRunId: 'payoff', timestamp: new Date().toISOString() } as any,
    })
    const content = await serializer.deserialize({ header: header as any, content: JSON.parse(JSON.stringify(wire)) })
    messageBus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'mtw.diagnostics',
        streamKey: 'global',
        timestamp: header.timestamp,
        header,
        getContent: () => Promise.resolve(content),
    } as any)
    await messageBus.flushAndSettle()
}

/** The findings the diagnostics leg proved the sweeps emit, in the order a run would heal them: fixed containment first, then cover. */
const deliverAll = async (scenario: ContainmentDriftScenario): Promise<void> => {
    for (const ephemeraId of [...scenario.expected.fixed, ...(scenario.redeliver?.fixed ?? [])]) {
        await deliver(FIXED_FINDING, ephemeraId)
    }
    for (const ephemeraId of [...scenario.expected.cover, ...(scenario.redeliver?.cover ?? [])]) {
        await deliver(COVER_FINDING, ephemeraId)
    }
}

describe('containment drift payoff: ephemera leg', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        jest.mocked(ephemeraDB.transactWrite).mockImplementation(applyTransact as any)
        jest.spyOn(internalCache.Positions, 'getLudicGraph').mockImplementation((async (hostId: string) => {
            const entry = world.get(hostId)
            if (!entry) {
                throw new Error(`no row for ${hostId}`)
            }
            return entry.graph
        }) as any)
        jest.spyOn(internalCache.Positions, 'set').mockImplementation(() => {})
        jest.spyOn(internalCache.Positions, 'invalidate').mockImplementation(() => {})
        jest.spyOn(internalCache.Positions, 'setMembershipContainers').mockImplementation(() => {})
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'invalidate').mockImplementation(() => {})
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'invalidate').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it.each(containmentDriftScenarios.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        world = seed(scenario.drifted)
        authoredAssets(scenario)

        await deliverAll(scenario)

        expect(normalizeMintedIds(storedRows())).toEqual(normalizeMintedIds(scenario.healed))
        // Not vacuous: a scenario whose sweeps emit findings is healed by a real write, and one that only lists or redelivers writes nothing.
        const healable = scenario.expected.fixed.length + scenario.expected.cover.length > 0
        expect(jest.mocked(ephemeraDB.transactWrite).mock.calls.length > 0).toBe(healable)

        // A redelivered finding finds nothing left to do: the heals judge before they write.
        jest.mocked(ephemeraDB.transactWrite).mockClear()
        await deliverAll(scenario)
        expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        expect(normalizeMintedIds(storedRows())).toEqual(normalizeMintedIds(scenario.healed))
    })
})
