import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraPositionGraphFieldPayload,
    EphemeraPositionRelationalEdgeData,
    HostRelationalEdgeKind,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import { referencesFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

export type HostRelationalEdge = {
    from: EphemeraObjectId
    to: EphemeraObjectId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom'])

export const toStoredRelationalEdge = (
    edge: HostRelationalEdge
): EphemeraPositionRelationalEdgeData => ({
    tag: 'Relational',
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    ...(edge.kind === 'Custom' && edge.relationLabel !== undefined
        ? { relationLabel: edge.relationLabel }
        : {}),
})

export function extractRelationalEdgesFromStored(
    graph: EphemeraPositionGraphFieldPayload | PlayPositionGraph
): HostRelationalEdge[] {
    const edges = graph.edges ?? []
    const relationalEdges: HostRelationalEdge[] = []

    for (const rawEdge of edges) {
        if (isEphemeraPositionRelationalEdgeData(rawEdge)) {
            relationalEdges.push({
                from: rawEdge.from,
                to: rawEdge.to,
                kind: rawEdge.kind,
                ...(rawEdge.relationLabel !== undefined ? { relationLabel: rawEdge.relationLabel } : {}),
            })
            continue
        }

        try {
            const exitEdge = new StandardExitEdge(rawEdge)
            void exitEdge
        } catch {
            if (
                rawEdge !== null
                && typeof rawEdge === 'object'
                && !Array.isArray(rawEdge)
                && (rawEdge as { tag?: string }).tag === 'Relational'
            ) {
                const obj = rawEdge as Record<string, unknown>
                if (
                    typeof obj.from === 'string'
                    && isEphemeraObjectId(obj.from)
                    && typeof obj.to === 'string'
                    && isEphemeraObjectId(obj.to)
                    && typeof obj.kind === 'string'
                    && HOST_RELATIONAL_EDGE_KINDS.has(obj.kind as HostRelationalEdgeKind)
                ) {
                    relationalEdges.push({
                        from: obj.from,
                        to: obj.to,
                        kind: obj.kind as HostRelationalEdgeKind,
                        ...(typeof obj.relationLabel === 'string' ? { relationLabel: obj.relationLabel } : {}),
                    })
                }
            }
        }
    }

    return relationalEdges
}

export function edgesMatch(
    a: HostRelationalEdge,
    b: HostRelationalEdge
): boolean {
    if (a.from !== b.from || a.to !== b.to || a.kind !== b.kind) {
        return false
    }
    if (a.kind === 'Custom') {
        return a.relationLabel === b.relationLabel
    }
    return true
}

export function nodeHasRelationalEdge(
    nodeId: EphemeraObjectId,
    edges: readonly HostRelationalEdge[]
): boolean {
    return edges.some((edge) => edge.from === nodeId || edge.to === nodeId)
}

/** True when a stored or play envelope edge references objectId as a relational or Exit endpoint. */
export function edgeReferencesObjectId(
    rawEdge: unknown,
    objectId: EphemeraObjectId
): boolean {
    if (isEphemeraPositionRelationalEdgeData(rawEdge)) {
        return rawEdge.from === objectId || rawEdge.to === objectId
    }

    try {
        const exitEdge = new StandardExitEdge(rawEdge)
        const endpointRefs = [
            ...referencesFromExitEndpoint(exitEdge.from),
            ...referencesFromExitEndpoint(exitEdge.to),
        ]
        return endpointRefs.some((ref) => ref.universalKey === objectId)
    }
    catch {
        return false
    }
}
