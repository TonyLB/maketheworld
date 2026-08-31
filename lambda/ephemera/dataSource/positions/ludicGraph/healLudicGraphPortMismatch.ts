import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload, EphemeraLudicGraphPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { classifyLudicGraphPortMismatch } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import { hostDataCategory } from './index'

type StoredHostMeta = { ludicGraph?: unknown }

export type HealLudicGraphPortMismatchDependencies = {
    getStoredLudicGraph?: (ephemeraId: EphemeraMembershipHostId) => Promise<unknown>
    writeHealedLudicGraph?: (
        ephemeraId: EphemeraMembershipHostId,
        payload: EphemeraLudicGraphFieldPayload
    ) => Promise<void>
}

export type HealLudicGraphPortMismatchOutcome =
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
 * Self-heal for a `ludicGraph` port whose denormalized exterior values disagree with the edge
 * held by the host the port itself names (LP6a, LD-18's out-of-band arm). A **sibling** of
 * [`healLudicGraphStructure`](healLudicGraphStructure.ts), not an extension of it: that repair
 * is single-record by construction --- shape drift is judged from one row --- and this one
 * cannot be judged without the referrer's row too.
 *
 * **Never call this from a read boundary,** for the same two reasons already shipped on its
 * sibling and restated by LD-18 from the other direction: a read-time default makes a stale row
 * indistinguishable from a current one, and a read-time repair makes every read a write. It runs
 * only from the diagnostics finding consumer or an explicit manual invocation.
 *
 * **Scoped to a disagreement with a named referrer.** Where the classifier reports no mismatch
 * --- including the gated cases: the referrer holds no edge into this port, or its graph is
 * absent or shape-stale --- this reports `stale: false` and writes nothing. Where the exterior
 * fan disagrees with *itself* there is a mismatch but no correction to write, so it reports
 * `healable: false`: the break is exterior, and picking one edge to believe would invent an
 * answer rather than repair one.
 *
 * **Crossing-port-only, and it inherits that rather than restating it.** A presence port has no
 * exterior edge to mirror, so the classifier reports no mismatch for one and this heal never
 * reaches its rewrite --- which is the point, since that rewrite would overwrite `kind` with
 * `'Present'` gone and destroy the binding. The branch lives in `classifyLudicGraphPortMismatch`
 * so the sweep and this recheck cannot drift apart on what a presence port means.
 */
export const healLudicGraphPortMismatch = async (
    ephemeraId: EphemeraMembershipHostId,
    portId: string,
    options: { dryRun: boolean },
    deps?: HealLudicGraphPortMismatchDependencies
): Promise<HealLudicGraphPortMismatchOutcome> => {
    const getStoredLudicGraph = deps?.getStoredLudicGraph ?? defaultGetStoredLudicGraph
    const writeHealedLudicGraph = deps?.writeHealedLudicGraph ?? defaultWriteHealedLudicGraph

    const ludicGraph = await getStoredLudicGraph(ephemeraId)
    // A row that fails the shape guard is the *structure* finding's business, not this one's:
    // repairing a port inside an unparseable payload would be writing back a shape nobody vetted.
    if (!isEphemeraLudicGraphFieldPayload(ludicGraph)) {
        return { stale: false }
    }
    const port = ludicGraph.ports.find((entry) => entry.portId === portId)
    if (!port) {
        return { stale: false }
    }

    // Re-read the referrer and re-classify rather than trusting the finding: at-least-once
    // delivery means the sweep's snapshot may be minutes old and already repaired, and a
    // recheck against the current pair is what makes redelivery a no-op instead of a rewrite.
    const referrerLudicGraph = await getStoredLudicGraph(port.fromHostId)
    const verdict = classifyLudicGraphPortMismatch({ hostId: ephemeraId, port, referrerLudicGraph })
    if (!verdict.mismatch) {
        return { stale: false }
    }
    if (!verdict.correction) {
        return { stale: true, healable: false, applied: false }
    }

    const repairedPort: EphemeraLudicGraphPort = {
        portId: port.portId,
        fromHostId: port.fromHostId,
        kind: verdict.correction.kind,
        ...(verdict.correction.exteriorRelationLabel === undefined
            ? {}
            : { exteriorRelationLabel: verdict.correction.exteriorRelationLabel }),
    }
    const repairedPayload: EphemeraLudicGraphFieldPayload = {
        ...ludicGraph,
        ports: ludicGraph.ports.map((entry) => (entry.portId === portId ? repairedPort : entry)),
    }
    if (!isEphemeraLudicGraphFieldPayload(repairedPayload)) {
        return { stale: true, healable: false, applied: false }
    }

    if (!options.dryRun) {
        await writeHealedLudicGraph(ephemeraId, repairedPayload)
    }

    return { stale: true, healable: true, repairedPayload, applied: !options.dryRun }
}
