/**
 * Tier: Prototype, not locked. Built because building it is the only affordable way to get
 * the evidence PR-8 (see taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md)
 * needs.
 *
 * Dependency tag --- the rollback set is exactly:
 *   - positions/ludicGraph/presenceSubGraph.ts (+ test)
 *   - positions/ludicCache/mergeReducer.ts (+ test)
 *   - their fixtures
 * No change to EphemeraLudicGraph, to ephemeraMeta.ts, or to any write path. If a slice finds
 * it needs one, that is a scope change to raise, not to take.
 *
 * Rollback trigger, named in advance: a bucket cannot be stated from the child's own graph
 * plus its bindings --- i.e. if deciding which nodes are in a binding turns out to require the
 * parent's graph, then presence is not binding-indexed and the reducer's premise fails.
 *
 * Not triggers: fixture verbosity, reducer size, or the number of cases the straddle rule
 * needs. Those are measurements this Prototype exists to take.
 *
 * Built under a since-deleted implementation plan (AGENT.ludicCacheReducer.planning.md);
 * its findings live on in PR-8 and PR-12 above.
 */
import type { EphemeraLudicGraphPort, EphemeraLudicPortAddress, EphemeraLudicTerminalId, EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdge } from '../ludicGraph'
import { EphemeraLudicGraph, nodeFromId, toStoredRelationalEdge } from '../ludicGraph'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import type { EphemeraLudicCacheEdge, EphemeraLudicCacheNode, EphemeraLudicCacheSupportHop } from './types'

/**
 * A crossing port **minted by a cut**, as distinct from one **authored on the whole** --- the
 * difference between *a cut to rejoin* and *a boundary to preserve*, which the same-host merge
 * has to make. A stub is minted carrying the severed edge's own `kind`, so the two are identical
 * in every typed field; the discriminator is the `STUB-` prefix `stubPortIdFromEdge` puts on the
 * id.
 *
 * **No `isCrossingPort` guard needed any more (presenceNodes Slice 7a, PN-23/PN-14):**
 * `EphemeraLudicGraphPort` collapsed to `EphemeraCrossingPort` alone once presence retired its
 * port record --- `graph.ports` never holds anything else, so every port here already IS a
 * crossing port and there is nothing left to filter out.
 *
 * **Why it is needed, concretely:** `subGraphFromNodes` now carries an authored crossing port into
 * every bucket whose edges reference it, so a port-to-port transit leg (LC10's shape --- entering
 * one boundary and leaving another without touching a node) puts the *same real* port in two
 * buckets. Matched as a stub, it would be spliced to itself into
 * `ROOM#HALL#PORT_S -[ropedTo]-> ROOM#HALL#PORT_S`, and silently, since `legsAgree` cannot object
 * to two identical legs.
 */
const isStubPort = (port: EphemeraLudicGraphPort): boolean => port.portId.startsWith('STUB-')

const hasPortTerminal = (portTerminal: EphemeraLudicPortAddress) => (edge: HostRelationalEdge): boolean =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) || ephemeraLudicTerminalsEqual(edge.to, portTerminal)

/**
 * Whether two legs of what is claimed to be one edge actually agree on the fields that make
 * them one edge --- `kind`, `relationLabel` on `Custom`, and `chainId`. Mirrors `edgesMatch`
 * (`ludicGraph/baseClasses.ts`), but that helper also compares endpoints, which two legs of a
 * crossing edge deliberately do not share (one side is port-qualified, the other is the far
 * graph's real node) --- so this is a narrower, local check, not a call to that helper.
 */
const legsAgree = (a: HostRelationalEdge, b: HostRelationalEdge): boolean => {
    if (a.kind !== b.kind) {
        return false
    }
    if (a.chainId !== b.chainId) {
        return false
    }
    // Both sides are tested even though the kind equality above already implies the second:
    // narrowing `a` does not narrow `b`, and the compiler needs the pair to reach either label.
    if (a.kind === 'Custom' && b.kind === 'Custom') {
        return a.relationLabel === b.relationLabel
    }
    return true
}

/** The non-port terminal of a leg known to touch `portTerminal` on one side. */
const outerTerminal = (
    edge: HostRelationalEdge,
    portTerminal: EphemeraLudicPortAddress
): EphemeraLudicTerminalId =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) ? edge.to : edge.from

/**
 * A pure, local re-encoding of a *collapsed* edge's identity --- the same field list
 * `edgesMatch` (`baseClasses.ts`) treats as an edge's identity, but read off the collapsed
 * edge's final, resolved endpoints rather than off stored data. Deliberately duplicated rather
 * than imported, matching `presenceSubGraph.ts`'s own `stubPortIdFromEdge` (LR-1's dependency
 * tag) --- this is a different call site (post-collapse, not pre-mint) and owes no more to that
 * one than the shared source field list already implies.
 *
 * **Known dormant gap (presenceNodes Slice 5, item 3), deliberately NOT closed here:** `terminalKey`
 * does not fold a presence-addressed port terminal (`{ owner, port: presenceUuid }`) down to its
 * bare `PRESENCE#{uuid}` form the way `ephemeraLudicTerminalsEqual` now does, so the two
 * representations of one presence binding would hash to different keys and fail to dedup. Left
 * unbuilt because, unlike that pairwise comparison, this is a *unary* canonicalization: `.port` is
 * a bare, unprefixed uuid indistinguishable in shape from an ordinary crossing-port id, so
 * classifying it as presence-or-not needs the in-scope presence-node-id set (available at every
 * call site) threaded in as a parameter --- a real change to this function's "pure and local"
 * design, not a drive-by fix. No current writer mints `{ owner, port: presenceUuid }` as a real
 * edge terminal (`buildCrossingLegs.ts` always mints a fresh crossing uuid, never reuses a
 * presence node's own), so the gap has no live caller today. Build it when one appears.
 */
const collapsedEdgeIdentityKey = (edge: EphemeraLudicCacheEdge): string => {
    const terminalKey = (terminal: EphemeraLudicTerminalId): string =>
        typeof terminal === 'string' ? terminal : `${terminal.owner}#${terminal.port}`
    return JSON.stringify([
        terminalKey(edge.from),
        terminalKey(edge.to),
        edge.kind,
        edge.kind === 'Custom' ? edge.relationLabel : '',
        edge.chainId ?? '',
    ])
}

/**
 * Collapse of crossing relation ports.
 *
 * A port that binds a child (the contained side) to its parent is minted and owned only by the
 * child's own graph (`AGENT.concepts.md`'s "Wholes, parts, and ports", clause 2 --- the interior
 * mints the binding, mirroring how a presence port is added to the *contained* thing's own
 * graph). A single relational edge spanning that boundary is therefore split into two **legs**,
 * sharing `kind` (and `relationLabel`/`chainId` where present) on both --- the reduction
 * convention recorded in `AGENT.presence.planning.md`'s PR-8 --- per the
 * `cup -[TiedTo]-> string` case:
 *
 * - **The parent's leg**, in `parentGraph.relationalEdges`: one terminal is an ordinary
 *   parent-side node, the other is `{ owner: childGraph.hostId, port }` --- already
 *   port-qualified, referencing a port it does not own.
 * - **The child's leg**, in `childGraph.relationalEdges`: one terminal is that same address
 *   (the child's own port, referenced from within its own graph), the other is the real
 *   interior node.
 *
 * For each crossing port on `childGraph` (every port, as of Slice 7a --- presence carries no
 * port record any more), this finds the two legs
 * that share its terminal, asserts they agree on identity fields (a mismatch is a data-integrity
 * break under this uniform-kind model, not a case to paper over --- see `legsAgree`), and
 * produces one collapsed edge: the parent leg with its port terminal rewritten to the child
 * leg's real interior node, carrying a one-hop, one-route `supportedBy` entry
 * (`[[{ presenceBucketIds: [presenceUuid], port: port.portId }]]`). Collapsed edges are then
 * grouped by `collapsedEdgeIdentityKey` --- **two crossing ports can independently collapse to
 * the same final `(from, to, kind)` triple**, and LR-8 requires that land on one record with two
 * routes side by side, never merged or tie-broken.
 *
 * **A port with no matching leg on one or both sides is incomplete data, not an error.** A
 * merge reducer cannot invent a missing leg (data may legitimately be mid-write), so that port
 * is skipped rather than throwing.
 *
 * Presence is bucket-membership metadata carried on nodes, not ports (`presenceSubGraph.ts`'s
 * own LR-6 note) --- `childGraph.ports` never contains one, so there is nothing to exclude here.
 *
 * **`presenceUuid` (PN-2/D8, presenceNodes Slice 4): the caller tells this function which of
 * `childGraph`'s own bindings it is folding** --- `childGraph` here is one bucket (the cut for one
 * specific presence binding), not the whole child graph, so the binding is context the caller
 * already has and this function cannot derive on its own. It becomes every collapsed hop's own
 * `presenceBucketIds` singleton; a real multi-binding OR only arises once more than one binding's
 * fold is merged into the same route, which is Slice 5/6's cross-host merge orchestration, not
 * built yet.
 */
export const collapseCrossingPorts = (
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph,
    presenceUuid: string
): EphemeraLudicCacheEdge[] => {
    const crossingPorts = childGraph.ports
    const presenceBucketId: EphemeraPresenceNodeId = `PRESENCE#${presenceUuid}`

    const collapsedLegs = crossingPorts.reduce<EphemeraLudicCacheEdge[]>((acc, port) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: childGraph.hostId, port: port.portId }
        const parentLeg = parentGraph.relationalEdges.find(hasPortTerminal(portTerminal))
        const childLeg = childGraph.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!parentLeg || !childLeg) {
            return acc
        }

        if (!legsAgree(parentLeg, childLeg)) {
            throw new Error(
                `Crossing port ${port.portId} on ${childGraph.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const childOuter = outerTerminal(childLeg, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? childOuter : terminal

        const collapsed: HostRelationalEdge = {
            ...parentLeg,
            from: rewrite(parentLeg.from),
            to: rewrite(parentLeg.to),
        }

        const hop: EphemeraLudicCacheSupportHop = { presenceBucketIds: [presenceBucketId], port: port.portId }
        return [...acc, { ...toStoredRelationalEdge(collapsed), supportedBy: [[hop]] }]
    }, [])

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    collapsedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, supportedBy: [...existing.supportedBy, ...edge.supportedBy] } : edge)
    })
    return [...byIdentity.values()]
}

/**
 * Fold-path probe (ISS8149 D1): reconstruction of a same-host interior edge that a fold would
 * cut into two independent halves rather than see whole, per `nodesFromPresenceBindings`'s own doc
 * comment in `presenceSubGraph.ts` --- cutting bucket A alone and bucket B alone, instead of
 * unioning their node sets before a single cut, leaves the straddling edge "independently
 * stub-ported on each side" with no rejoin step. `stubPortIdFromEdge` mints that stub id
 * deterministically from the edge's own fields (`from`/`to`/`kind`/`relationLabel`/`chainId`),
 * so both cuts land on the same portId for the same original edge --- the two bucket graphs
 * being joined here are two cuts of the *same* `EphemeraLudicGraph` (`hostId` in common), not a
 * parent and a child the way `collapseCrossingPorts` joins.
 *
 * Matches stub ports by shared `portId` --- present on both bucket graphs and **minted rather than
 * authored**, per `isStubPort`; an authored boundary can now legitimately appear in two buckets
 * and must not be spliced --- finds each side's leg touching that port terminal, asserts they agree exactly as
 * `collapseCrossingPorts` does, and rewrites bucket A's leg with bucket B's outer terminal to
 * recover the original edge. `supportedBy` is always `[]` --- this never crosses a membership
 * boundary, so there is no hop to record (D11: a same-host edge's dependence is a membership
 * fact, carried on the node record, not a traversal fact).
 */
export const collapseSameHostStubs = (
    bucketA: EphemeraLudicGraph,
    bucketB: EphemeraLudicGraph
): EphemeraLudicCacheEdge[] => {
    const stubIdsA = bucketA.ports.filter(isStubPort).map((port) => port.portId)
    const stubIdsB = new Set(bucketB.ports.filter(isStubPort).map((port) => port.portId))
    const sharedPortIds = stubIdsA.filter((portId) => stubIdsB.has(portId))

    const collapsedLegs = sharedPortIds.reduce<EphemeraLudicCacheEdge[]>((acc, portId) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: bucketA.hostId, port: portId }
        const legA = bucketA.relationalEdges.find(hasPortTerminal(portTerminal))
        const legB = bucketB.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!legA || !legB) {
            return acc
        }

        if (!legsAgree(legA, legB)) {
            throw new Error(
                `Stub port ${portId} on ${bucketA.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const outerB = outerTerminal(legB, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? outerB : terminal

        const collapsed: HostRelationalEdge = {
            ...legA,
            from: rewrite(legA.from),
            to: rewrite(legA.to),
        }

        return [...acc, { ...toStoredRelationalEdge(collapsed), supportedBy: [] }]
    }, [])

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    collapsedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, supportedBy: [...existing.supportedBy, ...edge.supportedBy] } : edge)
    })
    return [...byIdentity.values()]
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): the running state a walk needs between
 * steps is an ordinary `EphemeraLudicGraph`, not a bespoke bookkeeping type --- its own `ports`
 * (crossing stubs not yet matched) and the subset of its `relationalEdges` that still terminate
 * on one of them already *are* "what remains unresolved." A resolved edge is nothing more than
 * an ordinary edge already sitting in that same list, real terminal to real terminal.
 *
 * Generalizes `collapseSameHostStubs`'s matching --- same shared-`portId` rule, same
 * `legsAgree`/`outerTerminal`/rewrite --- from "join two static cuts once" to "fold one more cut
 * into a running graph, carrying forward whatever it can't yet resolve." A **stub** port that
 * matches on both sides is consumed (it no longer bounds anything); one that doesn't is carried
 * forward on both the port list and the edge list exactly as it arrived, since its match may not
 * have appeared yet --- the case a straddling edge between non-adjacent buckets needs. **An
 * authored crossing port is never matched and so always carried forward**, which is the same
 * outcome by a different route: it is a boundary of the whole, not a cut, and nothing at this
 * level can resolve it.
 */
export const mergeSameHostBucket = (
    accumulated: EphemeraLudicGraph,
    bucket: EphemeraLudicGraph
): EphemeraLudicGraph => {
    const accumulatedStubIds = new Set(accumulated.ports.filter(isStubPort).map((port) => port.portId))
    const bucketStubIds = bucket.ports.filter(isStubPort).map((port) => port.portId)
    const matchedPortIds = new Set(bucketStubIds.filter((portId) => accumulatedStubIds.has(portId)))

    const resolved = [...matchedPortIds].reduce<HostRelationalEdge[]>((acc, portId) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: accumulated.hostId, port: portId }
        const legA = accumulated.relationalEdges.find(hasPortTerminal(portTerminal))
        const legB = bucket.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!legA || !legB) {
            return acc
        }
        if (!legsAgree(legA, legB)) {
            throw new Error(
                `Stub port ${portId} on ${accumulated.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const outerB = outerTerminal(legB, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? outerB : terminal

        return [...acc, { ...legA, from: rewrite(legA.from), to: rewrite(legA.to) }]
    }, [])

    const touchesMatchedPort = (edge: HostRelationalEdge): boolean =>
        [...matchedPortIds].some((portId) => hasPortTerminal({ owner: accumulated.hostId, port: portId })(edge))

    //
    // Deduplicated, which it did not need to be before authored crossing ports were carried into
    // buckets: an edge with no qualified endpoint is now kept by *every* bucket (LC10's transit
    // leg), so the same leg arrives from the accumulator and from the bucket as two identical
    // copies. This is exact-duplicate removal, not edge identity --- both copies are cuts of one
    // source edge and agree in every field, so there is no reconciliation to do and no need to
    // reach for `collapsedEdgeIdentityKey`'s narrower notion.
    //
    const carriedForward = [...accumulated.relationalEdges, ...bucket.relationalEdges]
        .filter((edge) => !touchesMatchedPort(edge))
        .map((edge) => [JSON.stringify(toStoredRelationalEdge(edge)), edge] as const)
        .filter(([key], index, all) => all.findIndex(([other]) => other === key) === index)
        .map(([, edge]) => edge)

    // Presence nodes aren't reconstructible from `nodeIds` alone (`fromHostId`/`cover` have no
    // derivation from the id), and both sides carry the same ones anyway -- every presence node
    // is present in every cut of its own host (PN-6), so `accumulated` and `bucket` are unioning
    // identical copies here, not merging distinct facts. Component ids stay on the
    // nodeIds-then-nodeFromId path (presenceNodes Slice 3).
    const componentNodeIds = [...new Set([...accumulated.nodeIds, ...bucket.nodeIds])]
        .filter((id) => !isEphemeraPresenceNodeId(id))
    const presenceNodesById = new Map(
        [...accumulated.presenceNodes, ...bucket.presenceNodes].map((node) => [node.universalKey, node])
    )
    const nodes = [...componentNodeIds.map(nodeFromId), ...presenceNodesById.values()]
    const ports = [...accumulated.ports, ...bucket.ports].filter(
        (port, index, all) => !matchedPortIds.has(port.portId) && all.findIndex((p) => p.portId === port.portId) === index
    )

    return EphemeraLudicGraph.fromFieldPayload(accumulated.hostId, {
        rootId: accumulated.rootId,
        nodes,
        edges: [...resolved, ...carriedForward].map(toStoredRelationalEdge),
        ports,
    })
}

/**
 * The structure-arm `EphemeraLudicCacheNode` for each binding folded, one per `presenceUuid`
 * (presenceNodes Slice 4, item 3). `consolidated: true` because a binding only reaches this
 * function by being named in `presenceUuids` --- the set of buckets being pulled --- so every
 * node this produces is by construction one that WAS pulled; `EphemeraLudicCacheData` simply
 * never gets an entry for one that wasn't (PN-15's own "the marker is the node, never which
 * field carries it").
 *
 * `cover` is built directly off `nodesFromPresenceBinding`'s already-resolved set, root and the
 * binding's own id (PN-6 clause (c)) filtered out --- whatever remains is exactly this binding's
 * component membership, `'Full'` already expanded to a concrete list by that function regardless
 * of which arm the graph-side node carries (PN-19's cache-side legality: `'Full'` has no referent
 * once merged, so this is where it is made unrepresentable by construction). A binding named in
 * `presenceUuids` with no matching graph node (the same degenerate case
 * `nodesFromPresenceBinding` falls back on) mints nothing --- there is no real node to consolidate.
 *
 * **Clause 3's zero-or-all invariant, enforced here and only here:** *"if a host consolidates any
 * presence bucket, it adds all of its presence nodes."* `graph.presenceNodes` is this host's
 * TRUE, complete binding set --- the one place in this module with enough information to check
 * it, unlike a read-time guard over an already-assembled `EphemeraLudicCacheData`, which sees only
 * whichever subset a producer already chose to write and cannot tell a genuine partial pull from
 * a host with no other bindings to omit. `presenceUuids` naming a proper, non-empty subset of
 * `graph.presenceNodes` is exactly the violation clause 3 forbids; `[]` (unexamined) and the full
 * set (this host's own bucket fully consolidated) are the only two legal shapes.
 */
const assertZeroOrAllPresenceBindings = (graph: EphemeraLudicGraph, presenceUuids: string[]): void => {
    const allIds = new Set<string>(graph.presenceNodes.map((node) => node.universalKey))
    const requestedIds = new Set(presenceUuids.map((uuid) => `PRESENCE#${uuid}`))
    const requestedKnownCount = [...requestedIds].filter((id) => allIds.has(id)).length
    if (requestedKnownCount > 0 && requestedKnownCount < allIds.size) {
        throw new Error(
            `${graph.hostId} consolidates ${requestedKnownCount} of its ${allIds.size} presence bindings --- clause 3 requires zero or all`
        )
    }
}

const presenceCacheNodesFromFold = (
    graph: EphemeraLudicGraph,
    presenceUuids: string[]
): EphemeraLudicCacheNode[] => {
    assertZeroOrAllPresenceBindings(graph, presenceUuids)
    const root = ephemeraLudicTerminalOwner(graph.rootId)
    return presenceUuids.reduce<EphemeraLudicCacheNode[]>((acc, presenceUuid) => {
        const universalKey = `PRESENCE#${presenceUuid}` as EphemeraPresenceNodeId
        const presenceNode = graph.presenceNodes.find((node) => node.universalKey === universalKey)
        if (!presenceNode) {
            return acc
        }
        const members: EphemeraPresenceCoverEntry[] = [...nodesFromPresenceBinding(graph, presenceUuid)]
            .filter((id) => id !== root && id !== universalKey)
            .map((host) => ({ host: host as EphemeraPresenceCoverEntry['host'], presence: universalKey }))
        return [...acc, {
            tag: 'Presence' as const,
            universalKey,
            fromHostId: presenceNode.fromHostId,
            cover: { tag: 'Enumerated' as const, members },
            consolidated: true,
        }]
    }, [])
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): a single accumulating pass over `portIds`,
 * cutting each bucket and folding its stubs into the running graph in the same step --- not a
 * pass that cuts every bucket first and a second pass that matches stubs across the fully-cut
 * set. Order of `presenceUuids` does not affect the result: a still-open stub lives in the
 * accumulator's own state until something matches it, not in a side channel compared only to the
 * immediately preceding bucket.
 *
 * The final read-off is the accumulated graph's own edges that no longer touch any of its own
 * remaining `ports` --- those are the resolved interior edges. Anything still touching a
 * remaining port is a genuine unresolved boundary (this host is not fully covered by
 * `presenceUuids`) and is correctly not emitted, the same "incomplete data, not an error" stance
 * `collapseCrossingPorts` already takes.
 *
 * `nodes` (presenceNodes Slice 4, item 3): the structure-arm cache node for every binding folded,
 * via `presenceCacheNodesFromFold` above --- a separate pass over `presenceUuids` rather than a
 * side-effect of the accumulator, since a binding's own cover is a fact about `graph` alone and
 * needs no merge state to compute.
 */
export const foldSameHostBuckets = (
    graph: EphemeraLudicGraph,
    presenceUuids: string[]
): { nodes: EphemeraLudicCacheNode[]; edges: EphemeraLudicCacheEdge[] } => {
    const seed = EphemeraLudicGraph.fromFieldPayload(graph.hostId, { rootId: graph.rootId, nodes: [], edges: [], ports: [] })

    const folded = presenceUuids.reduce<EphemeraLudicGraph>((accumulated, presenceUuid) => {
        const bucket = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, presenceUuid))
        return mergeSameHostBucket(accumulated, bucket)
    }, seed)

    //
    // Not `isStubPort`, and deliberately: the test here is *still bounded*, not
    // *still unmatched*. An authored crossing port carried through the fold is a real boundary of
    // this host that no same-host merge can resolve --- only the parent's `collapseCrossingPorts`
    // can --- so a leg touching one is unresolved in exactly the sense this read-off means. Every
    // port in `folded.ports` is already a crossing port (Slice 7a: presence carries no port
    // record), so there is nothing left to filter.
    const remainingPortIds = folded.ports.map((port) => port.portId)
    const touchesRemainingPort = (edge: HostRelationalEdge): boolean =>
        remainingPortIds.some((portId) => hasPortTerminal({ owner: folded.hostId, port: portId })(edge))

    const resolvedLegs = folded.relationalEdges
        .filter((edge) => !touchesRemainingPort(edge))
        .map((edge) => ({ ...toStoredRelationalEdge(edge), supportedBy: [] as EphemeraLudicCacheEdge['supportedBy'] }))

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    resolvedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, supportedBy: [...existing.supportedBy, ...edge.supportedBy] } : edge)
    })
    return { nodes: presenceCacheNodesFromFold(graph, presenceUuids), edges: [...byIdentity.values()] }
}
