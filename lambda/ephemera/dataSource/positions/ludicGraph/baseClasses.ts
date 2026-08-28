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
 *
 * `edgeId` mirrors the stored type's optional identity (EA-8); the reasoning for the shape, and
 * for what it deliberately is not, lives on `EphemeraLudicRelationalEdgeBase`.
 */
type HostRelationalEdgeBase = {
    from: EphemeraLudicTerminalId
    to: EphemeraLudicTerminalId
    edgeId?: string
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
): EphemeraLudicRelationalEdgeData => {
    // Spread-when-present rather than `edgeId: edge.edgeId`, matching `toStored()`/`toJSON()` in
    // `index.ts`: an absent id must stay *absent*, not become an explicit `undefined` key that a
    // round trip through storage would then have to strip again.
    const identity: { edgeId?: string } = edge.edgeId !== undefined ? { edgeId: edge.edgeId } : {}
    return edge.kind === 'Custom'
        ? { tag: 'Relational', ...identity, from: edge.from, to: edge.to, kind: 'Custom', relationLabel: edge.relationLabel }
        : { tag: 'Relational', ...identity, from: edge.from, to: edge.to, kind: edge.kind }
}

export function extractRelationalEdgesFromStored(
    graph: EphemeraLudicGraphFieldPayload | PlayLudicGraph
): HostRelationalEdge[] {
    const edges = graph.edges ?? []
    const relationalEdges: HostRelationalEdge[] = []

    for (const rawEdge of edges) {
        if (isEphemeraLudicRelationalEdgeData(rawEdge)) {
            const identity: { edgeId?: string } = rawEdge.edgeId !== undefined ? { edgeId: rawEdge.edgeId } : {}
            relationalEdges.push(
                rawEdge.kind === 'Custom'
                    ? { ...identity, from: rawEdge.from, to: rawEdge.to, kind: 'Custom', relationLabel: rawEdge.relationLabel }
                    : { ...identity, from: rawEdge.from, to: rawEdge.to, kind: rawEdge.kind }
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
                    //
                    // A malformed `edgeId` is salvaged on the *label* pattern, not the `Custom`
                    // one: an id is a label an edge may carry and nothing more (EA-8), so a bad
                    // one is dropped and the relation kept. There is nothing to invent an id
                    // from, and losing a real relation over an unusable id is the worse outcome.
                    const identity: { edgeId?: string } = typeof obj.edgeId === 'string' && obj.edgeId.length > 0
                        ? { edgeId: obj.edgeId }
                        : {}
                    if (obj.kind === 'Custom') {
                        if (typeof obj.relationLabel === 'string' && obj.relationLabel.length > 0) {
                            relationalEdges.push({
                                ...identity,
                                from: obj.from,
                                to: obj.to,
                                kind: 'Custom',
                                relationLabel: obj.relationLabel,
                            })
                        }
                    }
                    else {
                        relationalEdges.push({
                            ...identity,
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

/**
 * **`edgeId` is deliberately not consulted here** (EA-8). Structure remains the sole authority
 * for edge sameness, so two edges alike in `(from, to, kind, relationLabel)` match whether or
 * not they carry ids, and whether or not those ids differ. That is what makes a mixed
 * population safe to introduce ahead of any constructor: nothing's behaviour changes.
 *
 * **The first constructor that mints ids must revisit this**, together with the other sites that
 * use structure *as* identity --- `addRelationalEdge`, `removeRelationalEdge` and
 * `applyRelationalPatch` here, and `findMatchingEdge` in `evaluateRelationalLegality.ts`. They
 * change together or not at all: id-aware matching in one and structural matching in another is
 * how a remove deletes an edge it was not aimed at.
 */
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
