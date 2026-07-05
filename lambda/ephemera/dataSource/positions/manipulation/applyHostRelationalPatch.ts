import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { playPositionGraphToStoredTopology } from '../membership/positionGraphMerge'
import type {
    ApplyHostRelationalPatchArgs,
    ApplyHostRelationalPatchResult,
    HostRelationalPatch,
} from './types'
import { buildHostRelationalPatchTransactItems } from './relational/hostRelationalPatchTransactItems'
import {
    bothNodesOnHostGraph,
    edgesMatch,
    extractRelationalEdgesFromGraph,
    type ObservedHostRelationalEdge,
    addRelationalEdgeToGraph,
    removeRelationalEdgeFromGraph,
} from './relational/relationalEdges'

export type ApplyHostRelationalPatchDependencies = {
    getPositionGraph?: (hostId: EphemeraRoomId) => Promise<PlayPositionGraph>
    transactWrite?: typeof ephemeraDB.transactWrite
}

const defaultGetPositionGraph = async (hostId: EphemeraRoomId): Promise<PlayPositionGraph> =>
    internalCache.Positions.getPositionGraph(hostId)

const affectedHostIds = (patches: HostRelationalPatch[]): EphemeraRoomId[] =>
    [...new Set(patches.map((patch) => patch.hostId))]

const toObservedEdge = (patch: HostRelationalPatch): ObservedHostRelationalEdge => ({
    from: patch.edge.from,
    to: patch.edge.to,
    kind: patch.edge.kind,
    ...(patch.edge.relationLabel !== undefined ? { relationLabel: patch.edge.relationLabel } : {}),
})

const validatePatches = (
    patches: HostRelationalPatch[],
    graphsByHost: Map<EphemeraRoomId, EphemeraPlayPositionGraph>
): { ok: true; changed: boolean } | { ok: false; errorCode: string; errorMessage: string } => {
    let anyChanged = false

    for (const patch of patches) {
        const graph = graphsByHost.get(patch.hostId)
        if (!graph) {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: `Missing graph for host ${patch.hostId}`,
            }
        }

        if (!isEphemeraRoomId(patch.hostId)) {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: `Relational patch host must be a room: ${patch.hostId}`,
            }
        }

        if (patch.edge.kind === 'Custom' && typeof patch.edge.relationLabel !== 'string') {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: 'Custom relational edge requires relationLabel',
            }
        }

        if (!bothNodesOnHostGraph(graph, patch.edge.from, patch.edge.to)) {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: `Nodes ${patch.edge.from} and/or ${patch.edge.to} not on host ${patch.hostId}`,
            }
        }

        const observedEdge = toObservedEdge(patch)
        const existingEdges = extractRelationalEdgesFromGraph(graph)
        const matchingEdge = existingEdges.find((edge) => edgesMatch(edge, observedEdge))

        if (patch.op === 'add') {
            if (matchingEdge) {
                continue
            }
            anyChanged = true
        }
        else if (!matchingEdge) {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: `Cannot remove relational edge ${patch.edge.from} -> ${patch.edge.to} on ${patch.hostId}: not present`,
            }
        }
        else {
            anyChanged = true
        }
    }

    return { ok: true, changed: anyChanged }
}

const computePostApplyGraphs = (
    patches: HostRelationalPatch[],
    graphsByHost: Map<EphemeraRoomId, EphemeraPlayPositionGraph>
): Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> => {
    const workingGraphs = new Map<EphemeraRoomId, EphemeraPlayPositionGraph>()

    for (const patch of patches) {
        const prior = workingGraphs.get(patch.hostId) ?? graphsByHost.get(patch.hostId)
        if (!prior) {
            continue
        }
        const observedEdge = toObservedEdge(patch)
        workingGraphs.set(
            patch.hostId,
            patch.op === 'add'
                ? addRelationalEdgeToGraph(prior, observedEdge)
                : removeRelationalEdgeFromGraph(prior, observedEdge)
        )
    }

    return Object.fromEntries(workingGraphs) as Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
}

export const applyHostRelationalPatch = async (
    args: ApplyHostRelationalPatchArgs,
    deps?: ApplyHostRelationalPatchDependencies
): Promise<ApplyHostRelationalPatchResult> => {
    const { patches } = args

    if (patches.length === 0) {
        return { ok: true, persisted: false, changed: false }
    }

    const getPositionGraph = deps?.getPositionGraph ?? defaultGetPositionGraph
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const hostIds = affectedHostIds(patches)
    const graphsByHost = new Map<EphemeraRoomId, EphemeraPlayPositionGraph>()

    await Promise.all(
        hostIds.map(async (hostId) => {
            const graph = playPositionGraphToStoredTopology(await getPositionGraph(hostId))
            graphsByHost.set(hostId, graph)
        })
    )

    const validation = validatePatches(patches, graphsByHost)
    if (!validation.ok) {
        return validation
    }

    if (!validation.changed) {
        return { ok: true, persisted: false, changed: false }
    }

    const postApplyGraphs = computePostApplyGraphs(patches, graphsByHost)

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems = buildHostRelationalPatchTransactItems(patches)
            if (transactItems.length === 0) {
                return
            }
            await transactWrite(transactItems)
            persisted = true
        }, { retryErrors: ['TransactionCanceledException'] })

        if (!persisted) {
            return { ok: true, persisted: false, changed: false }
        }

        return {
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs,
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}
