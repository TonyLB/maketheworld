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
 * `edgeId` mirrors the stored type's optional identity (EA-8); `chainId` mirrors the leg's
 * chain membership, which `edgesMatch` below *does* consult. The reasoning for both shapes, and
 * for what they deliberately are not, lives on `EphemeraLudicRelationalEdgeBase`.
 */
type HostRelationalEdgeBase = {
    from: EphemeraLudicTerminalId
    to: EphemeraLudicTerminalId
    edgeId?: string
    chainId?: string
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
    // round trip through storage would then have to strip again. `chainId` is carried the same
    // way and independently --- the two are unrelated facts about a leg, and either may be
    // present without the other.
    const identity: { edgeId?: string; chainId?: string } = {
        ...(edge.edgeId !== undefined ? { edgeId: edge.edgeId } : {}),
        ...(edge.chainId !== undefined ? { chainId: edge.chainId } : {}),
    }
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
            const identity: { edgeId?: string; chainId?: string } = {
                ...(rawEdge.edgeId !== undefined ? { edgeId: rawEdge.edgeId } : {}),
                ...(rawEdge.chainId !== undefined ? { chainId: rawEdge.chainId } : {}),
            }
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
                    //
                    // A malformed `chainId` is salvaged the same way, and the cost is *not* the
                    // same, so it is stated rather than assumed: dropping it does not merely
                    // un-label the leg, it makes the leg anonymous to a comparison that now
                    // consults the field --- so the recovered leg reads as a *different* leg
                    // from its own chain's siblings, on the mixed-pair rule. That is still the
                    // better outcome than discarding a real relation, and this path is only ever
                    // reached by a row the stored guard already refused.
                    const identity: { edgeId?: string; chainId?: string } = {
                        ...(typeof obj.edgeId === 'string' && obj.edgeId.length > 0 ? { edgeId: obj.edgeId } : {}),
                        ...(typeof obj.chainId === 'string' && obj.chainId.length > 0 ? { chainId: obj.chainId } : {}),
                    }
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
 * **`edgeId` is still deliberately not consulted here** (EA-8): it remains a label an edge may
 * carry, and nothing more.
 *
 * **`chainId` is consulted, and it is a veto rather than an authority** (P8 iteration 1, a
 * Prototype). Agreement on chain does not make two legs the same --- two legs of one chain share
 * a `chainId` and are different legs, told apart by their endpoints exactly as before. What
 * chain membership can do is *deny* a structural match. The four cases, given structure that
 * already agrees:
 *
 * - **Both absent** --- structure decides, which is the whole of today's behaviour, preserved.
 * - **Present and equal** --- the same leg.
 * - **Present and differing** --- different legs, though structurally identical. This is the
 *   case the rule exists for: without it, `addRelationalEdge` silently collapses two chains'
 *   legs into one and destroys a chain's leg.
 * - **One present, one absent** --- different legs (decided 2026-08-29, against a recorded lean
 *   towards absorption). No anonymous leg is absorbed by naming it. Chain membership is an
 *   explicit authoring act, so an `assign`/`strip` operation --- specified, not yet built, and
 *   gated on Edge-record storage --- is what names an existing leg.
 *
 * All four fall out of one inequality test, because `undefined === undefined`.
 *
 * **The sites that use structure as identity change together or not at all** ---
 * `addRelationalEdge`, `removeRelationalEdge` and `applyRelationalPatch` in `index.ts`, and
 * `findMatchingEdge` in `evaluateRelationalLegality.ts`. All four compose this helper, so
 * wiring the rule here is what keeps them in step; chain-aware matching in one and structural
 * matching in another is how a remove deletes a leg it was not aimed at.
 */
export function edgesMatch(
    a: HostRelationalEdge,
    b: HostRelationalEdge
): boolean {
    if (a.chainId !== b.chainId) {
        return false
    }
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
