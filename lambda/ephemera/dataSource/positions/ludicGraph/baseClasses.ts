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
type HostRelationalEdgeBase = {
    from: EphemeraLudicTerminalId
    to: EphemeraLudicTerminalId
}

/**
 * Carries `RelationalEdgeKindAndLabel`, so a label is representable only on `Custom` --- the
 * same partition the stored type draws. This mirrors `EphemeraLudicRelationalEdgeData` minus
 * its `tag`; the duplication with `manipulation/types.ts` is pre-existing and deliberately not
 * consolidated here (see `ludicGraph/AGENT.md`'s "Relational edge names" table).
 */
export type HostRelationalEdge =
    | (HostRelationalEdgeBase & { kind: Exclude<HostRelationalEdgeKind, 'Custom'> })
    | (HostRelationalEdgeBase & { kind: 'Custom'; relationLabel: string })

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom', 'In', 'PartOf', 'Present'])

export const toStoredRelationalEdge = (
    edge: HostRelationalEdge
): EphemeraLudicRelationalEdgeData => (
    edge.kind === 'Custom'
        ? { tag: 'Relational', from: edge.from, to: edge.to, kind: 'Custom', relationLabel: edge.relationLabel }
        : { tag: 'Relational', from: edge.from, to: edge.to, kind: edge.kind }
)

export function extractRelationalEdgesFromStored(
    graph: EphemeraLudicGraphFieldPayload | PlayLudicGraph
): HostRelationalEdge[] {
    const edges = graph.edges ?? []
    const relationalEdges: HostRelationalEdge[] = []

    for (const rawEdge of edges) {
        if (isEphemeraLudicRelationalEdgeData(rawEdge)) {
            relationalEdges.push(
                rawEdge.kind === 'Custom'
                    ? { from: rawEdge.from, to: rawEdge.to, kind: 'Custom', relationLabel: rawEdge.relationLabel }
                    : { from: rawEdge.from, to: rawEdge.to, kind: rawEdge.kind }
            )
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
                    // The recovery path for edges the guard rejected, and the two arms differ in
                    // what they salvage. A **non-`Custom`** row carrying a stray `relationLabel`
                    // is now guard-rejected (a label belongs to `Custom`); it is recovered with
                    // the label **stripped**, since the label was never meaningful for that kind
                    // and dropping the whole edge would lose a real relation. A **`Custom`** row
                    // with no usable label is *not* recoverable --- there is nothing to invent a
                    // label from, and this path previously admitted exactly that, producing an
                    // edge the stored guard would itself have refused.
                    if (obj.kind === 'Custom') {
                        if (typeof obj.relationLabel === 'string' && obj.relationLabel.length > 0) {
                            relationalEdges.push({
                                from: obj.from,
                                to: obj.to,
                                kind: 'Custom',
                                relationLabel: obj.relationLabel,
                            })
                        }
                    }
                    else {
                        relationalEdges.push({
                            from: obj.from,
                            to: obj.to,
                            kind: obj.kind as Exclude<HostRelationalEdgeKind, 'Custom'>,
                        })
                    }
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
    // Both sides are tested even though the kind equality above already implies the second:
    // narrowing `a` does not narrow `b`, and the compiler needs the pair to reach either label.
    if (a.kind === 'Custom' && b.kind === 'Custom') {
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
