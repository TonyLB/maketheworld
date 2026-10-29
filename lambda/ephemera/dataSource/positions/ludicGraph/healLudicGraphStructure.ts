import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    ephemeraLudicTerminalOwner,
    isEphemeraLudicGraphFieldPayload,
    isEphemeraLudicGraphPort,
    isEphemeraLudicTerminalId,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { markHostsStale } from '../ludicCache/markStale'
import { hostDataCategory, nodeFromId } from './index'

type StoredHostMeta = { ludicGraph?: unknown }

export type HealLudicGraphStructureDependencies = {
    getStoredLudicGraph?: (ephemeraId: EphemeraMembershipHostId) => Promise<unknown>
    writeHealedLudicGraph?: (
        ephemeraId: EphemeraMembershipHostId,
        payload: EphemeraLudicGraphFieldPayload
    ) => Promise<void>
}

export type HealLudicGraphStructureOutcome =
    | { stale: false }
    | { stale: true; healable: true; repairedPayload: EphemeraLudicGraphFieldPayload; applied: boolean }
    | { stale: true; healable: false; applied: false }

const defaultGetStoredLudicGraph = async (ephemeraId: EphemeraMembershipHostId): Promise<unknown> => {
    const row = await ephemeraDB.getItem<StoredHostMeta>({
        Key: { EphemeraId: ephemeraId, DataCategory: hostDataCategory(ephemeraId) },
        ProjectionFields: ['ludicGraph'],
    })
    return row?.ludicGraph
}

const defaultWriteHealedLudicGraph = async (
    ephemeraId: EphemeraMembershipHostId,
    payload: EphemeraLudicGraphFieldPayload
): Promise<void> => {
    await ephemeraDB.optimisticUpdate<StoredHostMeta>({
        Key: { EphemeraId: ephemeraId, DataCategory: hostDataCategory(ephemeraId) },
        updateKeys: ['ludicGraph'],
        updateReducer: (draft) => {
            draft.ludicGraph = payload
        },
    })
    // A heal is not a kernel commit: mark the host's rooms right after its own write.
    await markHostsStale([ephemeraId])
}

/**
 * A presence node stored before parent sets (PR-25) carries one optional `fromHostPresence`.
 * It becomes a one-element `fromHostPresences`, or an empty one when it was absent (a hostless
 * binding). A node already holding `fromHostPresences` is left as written; the guard judges the
 * result, so a malformed pointer still reports `healable: false`.
 */
const withParentSet = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || (node as { tag?: unknown }).tag !== 'Presence' || 'fromHostPresences' in node) {
        return node
    }
    const { fromHostPresence, ...rest } = node as { fromHostPresence?: unknown }
    return { ...rest, fromHostPresences: fromHostPresence === undefined ? [] : [fromHostPresence] }
}

/**
 * Scoped, canonical repair for four fields: `rootId` on a host-bound graph (canonically
 * `hostId`) and the root's own node (canonically derivable from `rootId` alone via
 * `nodeFromId`), recorded-never-derived per `ludicGraph/AGENT.md`; and `ports`, the egress list,
 * defaulted to `[]`; and a presence node's parent set (`withParentSet`). The `ports` default is the interim posture of AB-62 (abstraction-layers plan)
 * (a graph that exists but carries no recorded `ports` is treated as *not yet written*, not as
 * *lazily always empty*): it is a one-time write-carrying repair, not a `??=` read-boundary
 * default (`fromFieldPayload`/the guard stay strict), and it does not resolve the
 * materialize-vs-lazy-vs-derive question --- a later slice may need to replace it once
 * AB-55 lands. Everything else about the stored shape is left untouched; a row that is
 * stale for any other reason is reported `healable: false` rather than silently rewritten.
 */
const computeRepairedPayload = (
    ephemeraId: EphemeraMembershipHostId,
    ludicGraph: Record<string, unknown>
): EphemeraLudicGraphFieldPayload | undefined => {
    const storedRootId = ludicGraph.rootId
    const rootId = isEphemeraLudicTerminalId(storedRootId) ? storedRootId : ephemeraId
    const rootOwner = ephemeraLudicTerminalOwner(rootId)

    const nodes = Array.isArray(ludicGraph.nodes) ? ludicGraph.nodes.map(withParentSet) : []
    const hasRootNode = nodes.some((node) => (
        node && typeof node === 'object' && (node as { universalKey?: unknown }).universalKey === rootOwner
    ))
    const repairedNodes = hasRootNode ? nodes : [nodeFromId(rootOwner), ...nodes]

    const storedPorts = ludicGraph.ports
    const ports = Array.isArray(storedPorts) && storedPorts.every((entry) => isEphemeraLudicGraphPort(entry))
        ? (storedPorts as EphemeraLudicGraphFieldPayload['ports'])
        : []

    const repaired: EphemeraLudicGraphFieldPayload = {
        rootId,
        nodes: repairedNodes as EphemeraLudicGraphFieldPayload['nodes'],
        ...('edges' in ludicGraph ? { edges: ludicGraph.edges as EphemeraLudicGraphFieldPayload['edges'] } : {}),
        ports,
    }
    return isEphemeraLudicGraphFieldPayload(repaired) ? repaired : undefined
}

/**
 * Self-heal for `ludicGraph` structural staleness. Idempotent: a row already matching
 * the shipped shape is reported `stale: false` and nothing is written, in either mode.
 *
 * **Never call this from a read boundary.** `fromFieldPayload`/`isEphemeraLudicGraphFieldPayload`
 * must stay strict --- this repair is the one-time, write-carrying opposite of a `??=` default,
 * and it must only ever run from the diagnostics finding consumer or an explicit manual
 * invocation (matching `persistClearStoredLudicGraphs`'s precedent), never inline in a read path.
 */
export const healLudicGraphStructure = async (
    ephemeraId: EphemeraMembershipHostId,
    options: { dryRun: boolean },
    deps?: HealLudicGraphStructureDependencies
): Promise<HealLudicGraphStructureOutcome> => {
    const getStoredLudicGraph = deps?.getStoredLudicGraph ?? defaultGetStoredLudicGraph
    const writeHealedLudicGraph = deps?.writeHealedLudicGraph ?? defaultWriteHealedLudicGraph

    const ludicGraph = await getStoredLudicGraph(ephemeraId)
    if (ludicGraph === undefined || isEphemeraLudicGraphFieldPayload(ludicGraph)) {
        return { stale: false }
    }
    if (!ludicGraph || typeof ludicGraph !== 'object') {
        return { stale: true, healable: false, applied: false }
    }

    const repairedPayload = computeRepairedPayload(ephemeraId, ludicGraph as Record<string, unknown>)
    if (!repairedPayload) {
        return { stale: true, healable: false, applied: false }
    }

    if (!options.dryRun) {
        await writeHealedLudicGraph(ephemeraId, repairedPayload)
    }

    return { stale: true, healable: true, repairedPayload, applied: !options.dryRun }
}
