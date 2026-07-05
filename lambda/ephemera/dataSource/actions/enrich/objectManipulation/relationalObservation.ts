import type { EphemeraId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import { extractObjectIdsFromPlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

import type { HostRelationalEdgeKind } from './relationKind'

/**
 * Provisional relational edge wire shape on host positionGraph.edges (B3).
 * B4 must align WML schema and gateway projection with this envelope.
 */
export type ProvisionalRelationalEdgeData = {
    tag: 'Relational'
    from: EphemeraId
    to: EphemeraId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

export type ObservedHostRelationalEdge = {
    from: EphemeraObjectId
    to: EphemeraObjectId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom'])

function isProvisionalRelationalEdgeData(raw: unknown): raw is ProvisionalRelationalEdgeData {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return false
    }
    const obj = raw as Record<string, unknown>
    if (obj.tag !== 'Relational') {
        return false
    }
    if (typeof obj.from !== 'string' || typeof obj.to !== 'string') {
        return false
    }
    if (typeof obj.kind !== 'string' || !HOST_RELATIONAL_EDGE_KINDS.has(obj.kind as HostRelationalEdgeKind)) {
        return false
    }
    if (obj.relationLabel !== undefined && typeof obj.relationLabel !== 'string') {
        return false
    }
    return isEphemeraObjectId(obj.from) && isEphemeraObjectId(obj.to)
}

function parseRelationalEdge(rawEdge: unknown): ObservedHostRelationalEdge | undefined {
    if (!isProvisionalRelationalEdgeData(rawEdge)) {
        return undefined
    }
    return {
        from: rawEdge.from as EphemeraObjectId,
        to: rawEdge.to as EphemeraObjectId,
        kind: rawEdge.kind,
        ...(rawEdge.relationLabel !== undefined ? { relationLabel: rawEdge.relationLabel } : {}),
    }
}

export function extractRelationalEdgesFromPlayPositionGraph(
    graph: PlayPositionGraph
): ObservedHostRelationalEdge[] {
    const edges = graph.edges ?? []
    const relationalEdges: ObservedHostRelationalEdge[] = []

    for (const rawEdge of edges) {
        let exitEdge: StandardExitEdge
        try {
            exitEdge = new StandardExitEdge(rawEdge)
            void exitEdge
            continue
        } catch {
            // not an exit edge; try relational envelope
        }

        const parsed = parseRelationalEdge(rawEdge)
        if (parsed !== undefined) {
            relationalEdges.push(parsed)
        }
    }

    return relationalEdges
}

export function extractObjectIdsOnHostGraph(graph: PlayPositionGraph): EphemeraObjectId[] {
    return extractObjectIdsFromPlayPositionGraph(graph)
}

export function edgesMatch(
    a: ObservedHostRelationalEdge,
    b: ObservedHostRelationalEdge
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
    edges: readonly ObservedHostRelationalEdge[]
): boolean {
    return edges.some((edge) => edge.from === nodeId || edge.to === nodeId)
}
