/**
 * Slice 4 of `AGENT.componentLudicGraphAlignment.planning.md`: the stored-to-wire projection.
 * Alignment (Slices 0-3) made `StandardLudicGraphData` the same type contract as
 * `EphemeraLudicGraphFieldPayload`; this is the function that actually exercises it, sub-graphed
 * by presence binding (the lift rule's binding parameter, carried even while arity is 1 today).
 *
 * Both directions live here, not just the forward one -- `fromWireLudicGraph` exists so the
 * totality round-trip test can assert what alignment claims: same shape in, same shape out,
 * minus only what the binding cut removes.
 *
 * LG-11 (decided during this slice): stored relational edges can land on a port-qualified
 * terminal (a crossing port, or a presence binding's exterior address) or directly on a bare
 * presence-node id (PR-15/PN-6 clause (c), reached from inside a binding's own graph). Both were
 * unrepresentable in `StandardLudicRelationalEdgeData.from`/`to` before this slice -- widened in
 * `packages/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge.ts` (`StandardLudicTerminalData`)
 * and the `StandardLudicRelationalEdge` class alongside this file, so the projection below has
 * something to project onto.
 */
import type {
    EphemeraLudicGraphComponentNode,
    EphemeraLudicGraphFieldPayload,
    EphemeraLudicGraphNode,
    EphemeraLudicGraphPort,
    EphemeraLudicTerminalId,
    EphemeraLudicTerminalPrimitive,
    EphemeraPresenceCover,
    HostRelationalEdgeKind,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'
import type {
    LudicGraphNodeListData,
    LudicGraphPortListData,
    StandardLudicGraphData,
    StandardLudicGraphNodeData,
    StandardLudicGraphPortData,
    StandardLudicGraphPresenceCoverData,
    StandardLudicGraphPresenceNodeData,
} from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'
import { isStandardLudicGraphPresenceNodeData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'
import type {
    LudicEdgeListData,
    StandardLudicRelationalEdgeData,
    StandardLudicTerminalData,
} from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge'
import { isStandardLudicNavigationEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/ludicEdge'

import { EphemeraLudicGraph, nodeFromId, toStoredRelationalEdge, type HostRelationalEdge } from './index'
import { nodesFromPresenceBinding, subGraphFromNodes } from './presenceSubGraph'

//
// Bare-id <-> StandardReferenceData. An EphemeraId (`ROOM#<uuid>`, etc.) is already a
// `ComponentUUID` by construction (`${Uppercase<Tag>}#${string}`), so this is a cast, not a
// lookup -- the tag is embedded in the id's own prefix, exactly as `nodeFromId`'s dispatch
// already relies on. Presence ids are excluded at the type level: they are never a component.
//

const ephemeraComponentIdToReferenceData = (id: EphemeraMembershipHostId): StandardReferenceData =>
    id as unknown as StandardReferenceData

const referenceDataToEphemeraComponentId = (data: StandardReferenceData): EphemeraMembershipHostId =>
    (typeof data === 'string' ? data : data.universalKey) as unknown as EphemeraMembershipHostId

//
// Terminal conversion (LG-11): a bare component id, a bare presence-node id, or a port-qualified
// address on a component. Mirrors `EphemeraLudicTerminalId` <-> `StandardLudicTerminalData`.
//

const ephemeraTerminalToWire = (terminal: EphemeraLudicTerminalId): StandardLudicTerminalData => {
    if (typeof terminal === 'string') {
        return isEphemeraPresenceNodeId(terminal)
            ? { presence: terminal }
            : ephemeraComponentIdToReferenceData(terminal)
    }
    return { owner: ephemeraComponentIdToReferenceData(terminal.owner), port: terminal.port }
}

const wireTerminalToEphemera = (data: StandardLudicTerminalData): EphemeraLudicTerminalId => {
    if (typeof data === 'object' && data !== null && 'presence' in data) {
        return data.presence as EphemeraPresenceNodeId
    }
    if (typeof data === 'object' && data !== null && 'owner' in data) {
        return { owner: referenceDataToEphemeraComponentId(data.owner), port: data.port }
    }
    return referenceDataToEphemeraComponentId(data) as EphemeraLudicTerminalPrimitive
}

//
// Presence cover conversion. `fromHostId`/cover-entry `host` are always bare component ids
// (`EphemeraLudicGraphStructureNode`/`EphemeraPresenceCoverEntry`), never port-qualified -- no
// terminal widening needed on this arm.
//

const coverToWire = (cover: EphemeraPresenceCover): StandardLudicGraphPresenceCoverData =>
    cover.tag === 'Full'
        ? { tag: 'Full' }
        : {
            tag: 'Enumerated',
            members: cover.members.map((entry) => ({
                host: ephemeraComponentIdToReferenceData(entry.host),
                presence: entry.presence,
            })),
        }

const wireCoverToEphemera = (cover: StandardLudicGraphPresenceCoverData): EphemeraPresenceCover =>
    cover.tag === 'Full'
        ? { tag: 'Full' }
        : {
            tag: 'Enumerated',
            members: cover.members.map((entry) => ({
                host: referenceDataToEphemeraComponentId(entry.host) as EphemeraLudicGraphComponentNode['universalKey'],
                presence: entry.presence as EphemeraPresenceNodeId,
            })),
        }

//
// Node conversion. One field, mirroring `EphemeraLudicGraph._nodes` (LG-8), so this reshapes
// nothing -- a component node becomes a bare reference, a presence node becomes the typed arm.
//

const nodeToWire = (node: EphemeraLudicGraphNode): StandardLudicGraphNodeData =>
    node.tag === 'Presence'
        ? {
            tag: 'Presence',
            universalKey: node.universalKey,
            fromHostId: ephemeraComponentIdToReferenceData(node.fromHostId),
            cover: coverToWire(node.cover),
        }
        : ephemeraComponentIdToReferenceData(node.universalKey)

const wireNodeToEphemera = (data: StandardLudicGraphNodeData): EphemeraLudicGraphNode => {
    if (isStandardLudicGraphPresenceNodeData(data)) {
        return {
            tag: 'Presence',
            universalKey: data.universalKey as EphemeraPresenceNodeId,
            fromHostId: referenceDataToEphemeraComponentId(data.fromHostId),
            cover: wireCoverToEphemera(data.cover),
        }
    }
    if (typeof data === 'object' && data !== null && 'tag' in data && (data.tag === 'Replace' || data.tag === 'Remove')) {
        throw new Error('fromWireLudicGraph: a Replace/Remove-wrapped node entry is out of scope -- a projected stored graph never carries an authoring diff')
    }
    return nodeFromId(referenceDataToEphemeraComponentId(data as StandardReferenceData))
}

//
// Edge conversion. Stored relational edges are always Membership/Peer kind (never
// Navigation/Topology -- confirmed by `HOST_RELATIONAL_EDGE_KINDS`, which the ephemera-stored
// guard already narrows to), so this only ever produces/consumes the relational arm of WML's
// `LudicEdgeListData`.
//

const edgeToWire = (edge: HostRelationalEdge): StandardLudicRelationalEdgeData => {
    const base = {
        kind: edge.kind,
        from: ephemeraTerminalToWire(edge.from),
        to: ephemeraTerminalToWire(edge.to),
        ...(edge.edgeId !== undefined ? { edgeId: edge.edgeId } : {}),
        ...(edge.chainId !== undefined ? { chainId: edge.chainId } : {}),
    }
    return (edge.kind === 'Custom'
        ? { ...base, kind: 'Custom' as const, relationLabel: edge.relationLabel }
        : base) as StandardLudicRelationalEdgeData
}

const wireEdgeToEphemera = (data: StandardLudicRelationalEdgeData): HostRelationalEdge => {
    const identity: { edgeId?: string; chainId?: string } = {
        ...(data.edgeId !== undefined ? { edgeId: data.edgeId } : {}),
        ...(data.chainId !== undefined ? { chainId: data.chainId } : {}),
    }
    const from = wireTerminalToEphemera(data.from)
    const to = wireTerminalToEphemera(data.to)
    return (data.kind === 'Custom'
        ? { ...identity, from, to, kind: 'Custom' as const, relationLabel: data.relationLabel }
        : { ...identity, from, to, kind: data.kind }) as HostRelationalEdge
}

//
// Port conversion. `fromHostId` admits a `PRESENCE#` id as well as a component host (a stub
// minted for a same-host straddle over a disqualified presence-binding terminal), which is
// exactly why the wire type's `fromHostId` is `StandardReferenceData | string` rather than
// `StandardReferenceData` alone.
//

const portToWire = (port: EphemeraLudicGraphPort): StandardLudicGraphPortData => ({
    portId: port.portId,
    fromHostId: isEphemeraPresenceNodeId(port.fromHostId)
        ? port.fromHostId
        : ephemeraComponentIdToReferenceData(port.fromHostId),
    kind: port.kind,
    ...(port.exteriorRelationLabel !== undefined ? { exteriorRelationLabel: port.exteriorRelationLabel } : {}),
})

const wirePortToEphemera = (data: StandardLudicGraphPortData): EphemeraLudicGraphPort => ({
    portId: data.portId,
    fromHostId: (typeof data.fromHostId === 'string' && isEphemeraPresenceNodeId(data.fromHostId))
        ? data.fromHostId
        : referenceDataToEphemeraComponentId(data.fromHostId as StandardReferenceData),
    kind: data.kind as HostRelationalEdgeKind,
    ...(data.exteriorRelationLabel !== undefined ? { exteriorRelationLabel: data.exteriorRelationLabel } : {}),
})

/**
 * The forward projection: cut `graph` to `presenceUuid`'s bucket via the real arity-general
 * primitives (never a hand-rolled node walk), then reshape the cut's stored fields into WML's
 * aligned wire type. Binding-grained even though every real binding is `Full` today -- the lift
 * rule's central case for this slice.
 */
export const toWireLudicGraph = (
    graph: EphemeraLudicGraph,
    presenceUuid: string
): StandardLudicGraphData => {
    const cut = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, presenceUuid))
    const stored = cut.toStored()
    const nodes: LudicGraphNodeListData = stored.nodes.map(nodeToWire)
    const edges: LudicEdgeListData = cut.relationalEdges.map(edgeToWire)
    const ports: LudicGraphPortListData = stored.ports.map(portToWire)
    return {
        rootId: ephemeraComponentIdToReferenceData(stored.rootId as EphemeraMembershipHostId),
        ...(nodes.length ? { nodes } : {}),
        ...(edges.length ? { edges } : {}),
        ...(ports.length ? { ports } : {}),
    }
}

/**
 * Slice 5a: the un-cut projection, for a host that is never itself a hosted thing with presence
 * multiplicity -- a Room. Rooms are never members of another play graph (`AGENT.ludicNetwork.md`
 * section 1), so there is no presence binding to sub-graph by; this ships the host's whole stored
 * graph as-is, reusing the same field-by-field mappers `toWireLudicGraph` uses after its cut.
 */
export const toWireLudicGraphFull = (graph: EphemeraLudicGraph): StandardLudicGraphData => {
    const stored = graph.toStored()
    const nodes: LudicGraphNodeListData = stored.nodes.map(nodeToWire)
    const edges: LudicEdgeListData = graph.relationalEdges.map(edgeToWire)
    const ports: LudicGraphPortListData = stored.ports.map(portToWire)
    return {
        rootId: ephemeraComponentIdToReferenceData(stored.rootId as EphemeraMembershipHostId),
        ...(nodes.length ? { nodes } : {}),
        ...(edges.length ? { edges } : {}),
        ...(ports.length ? { ports } : {}),
    }
}

/**
 * The inverse, for the totality round-trip test: WML's wire shape back to a stored field
 * payload. A `Navigation`-kind edge entry is out of scope and throws rather than silently
 * dropping -- stored payloads never carry one (Exit lives only in Area's own authored `edges`,
 * never in `Meta::*.ludicGraph`), so a caller that feeds one through here has fed the wrong data
 * in, not data this function is entitled to discard.
 */
export const fromWireLudicGraph = (
    hostId: EphemeraMembershipHostId,
    data: StandardLudicGraphData
): EphemeraLudicGraphFieldPayload => {
    const nodes = (data.nodes ?? []).map(wireNodeToEphemera)
    const edges = (data.edges ?? []).map((entry) => {
        if (isStandardLudicNavigationEdgeData(entry) || (typeof entry === 'object' && entry !== null && 'tag' in entry && (entry.tag === 'Replace' || entry.tag === 'Remove'))) {
            throw new Error('fromWireLudicGraph: a Navigation-kind or Replace/Remove-wrapped edge entry is out of scope -- a stored graph never carries either')
        }
        return toStoredRelationalEdge(wireEdgeToEphemera(entry as StandardLudicRelationalEdgeData))
    })
    const ports = (data.ports ?? []).map(wirePortToEphemera)
    return {
        rootId: data.rootId ? referenceDataToEphemeraComponentId(data.rootId) : hostId,
        nodes,
        ...(edges.length ? { edges } : {}),
        ports,
    }
}
