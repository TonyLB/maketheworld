import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraLudicGraphFieldPayload,
    EphemeraLudicRelationalEdgeData,
    EphemeraLudicTerminalId,
    EphemeraLudicTerminalPrimitive,
    HostRelationalEdgeKind,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    ephemeraLudicTerminalRefersTo,
    ephemeraLudicTerminalsEqual,
    isEphemeraLudicRelationalEdgeData,
    isEphemeraLudicTerminalId,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import { referencesFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

/**
 * `from`/`to` are `EphemeraLudicTerminalId` (LP7) --- any legal host-kind component, or a
 * port-qualified reference on one.
 */
export type HostRelationalEdge = {
    from: EphemeraLudicTerminalId
    to: EphemeraLudicTerminalId
    kind: HostRelationalEdgeKind
    relationLabel?: string
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom', 'In', 'PartOf'])

export const toStoredRelationalEdge = (
    edge: HostRelationalEdge
): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    ...(edge.kind === 'Custom' && edge.relationLabel !== undefined
        ? { relationLabel: edge.relationLabel }
        : {}),
})

export function extractRelationalEdgesFromStored(
    graph: EphemeraLudicGraphFieldPayload | PlayLudicGraph
): HostRelationalEdge[] {
    const edges = graph.edges ?? []
    const relationalEdges: HostRelationalEdge[] = []

    for (const rawEdge of edges) {
        if (isEphemeraLudicRelationalEdgeData(rawEdge)) {
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
                    isEphemeraLudicTerminalId(obj.from)
                    && isEphemeraLudicTerminalId(obj.to)
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
    if (!ephemeraLudicTerminalsEqual(a.from, b.from) || !ephemeraLudicTerminalsEqual(a.to, b.to) || a.kind !== b.kind) {
        return false
    }
    if (a.kind === 'Custom') {
        return a.relationLabel === b.relationLabel
    }
    return true
}

export function nodeHasRelationalEdge(
    nodeId: EphemeraLudicTerminalPrimitive,
    edges: readonly HostRelationalEdge[]
): boolean {
    return edges.some((edge) => ephemeraLudicTerminalRefersTo(edge.from, nodeId) || ephemeraLudicTerminalRefersTo(edge.to, nodeId))
}

/** True when a stored or play envelope edge references objectId as a relational or Exit endpoint. */
export function edgeReferencesObjectId(
    rawEdge: unknown,
    objectId: EphemeraObjectId
): boolean {
    if (isEphemeraLudicRelationalEdgeData(rawEdge)) {
        return ephemeraLudicTerminalRefersTo(rawEdge.from, objectId) || ephemeraLudicTerminalRefersTo(rawEdge.to, objectId)
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
