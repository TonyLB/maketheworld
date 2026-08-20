import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    ephemeraLudicTerminalOwner,
    isEphemeraLudicGraphFieldPayload,
    isEphemeraLudicPortAddress,
    isEphemeraLudicTerminalPrimitive,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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
}

/**
 * Scoped, canonical repair for the two fields premise 10 (`ludicGraph/AGENT.md`) allows a
 * one-time write to default: `rootId` on a host-bound graph (canonically `hostId`) and the
 * root's own node (canonically derivable from `rootId` alone via `nodeFromId`) --- LP4i.
 * Everything else about the stored shape is left untouched; a row that is stale for any other
 * reason is reported `healable: false` rather than silently rewritten.
 */
const computeRepairedPayload = (
    ephemeraId: EphemeraMembershipHostId,
    ludicGraph: Record<string, unknown>
): EphemeraLudicGraphFieldPayload | undefined => {
    const storedRootId = ludicGraph.rootId
    const rootId = (typeof storedRootId === 'string' ? isEphemeraLudicTerminalPrimitive(storedRootId) : isEphemeraLudicPortAddress(storedRootId))
        ? (storedRootId as EphemeraLudicGraphFieldPayload['rootId'])
        : ephemeraId
    const rootOwner = ephemeraLudicTerminalOwner(rootId)

    const nodes = Array.isArray(ludicGraph.nodes) ? ludicGraph.nodes : []
    const hasRootNode = nodes.some((node) => (
        node && typeof node === 'object' && (node as { universalKey?: unknown }).universalKey === rootOwner
    ))
    const repairedNodes = hasRootNode ? nodes : [nodeFromId(rootOwner), ...nodes]

    const repaired: EphemeraLudicGraphFieldPayload = {
        rootId,
        nodes: repairedNodes as EphemeraLudicGraphFieldPayload['nodes'],
        ...('edges' in ludicGraph ? { edges: ludicGraph.edges as EphemeraLudicGraphFieldPayload['edges'] } : {}),
    }
    return isEphemeraLudicGraphFieldPayload(repaired) ? repaired : undefined
}

/**
 * Self-heal for `ludicGraph` structural staleness (LP4i). Idempotent: a row already matching
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
