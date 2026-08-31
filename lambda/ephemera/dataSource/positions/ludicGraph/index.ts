import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    extractCharacterIdsFromPlayLudicGraph,
    extractObjectIdsFromPlayLudicGraph,
    projectComponentGraphFromStoredLudicGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type {
    EphemeraLudicGraphData,
    EphemeraLudicGraphFieldPayload,
    EphemeraLudicGraphNode,
    EphemeraLudicGraphPort,
    EphemeraLudicRelationalEdgeData,
    EphemeraLudicTerminalId,
    EphemeraLudicTerminalPrimitive,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, ephemeraLudicTerminalRefersTo, ephemeraLudicTerminalsEqual, isEphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

import type { HostRelationalPatch } from '../manipulation/types'
import {
    edgesMatch,
    extractRelationalEdgesFromStored,
    edgeReferencesObjectId,
    nodeHasRelationalEdge,
    toStoredRelationalEdge,
    type HostRelationalEdge,
} from './baseClasses'

export type { HostRelationalEdge } from './baseClasses'
export { edgesMatch, nodeHasRelationalEdge, toStoredRelationalEdge, edgeReferencesObjectId } from './baseClasses'

export const characterNode = (universalKey: EphemeraCharacterId): EphemeraLudicGraphNode => ({
    tag: 'Character',
    universalKey,
})

export const objectNode = (universalKey: EphemeraObjectId): EphemeraLudicGraphNode => ({
    tag: 'Object',
    universalKey,
})

export const roomNode = (universalKey: EphemeraRoomId): EphemeraLudicGraphNode => ({
    tag: 'Room',
    universalKey,
})

export const featureNode = (universalKey: EphemeraFeatureId): EphemeraLudicGraphNode => ({
    tag: 'Feature',
    universalKey,
})

export const areaNode = (universalKey: EphemeraAreaId): EphemeraLudicGraphNode => ({
    tag: 'Area',
    universalKey,
})

/**
 * Dispatches an arbitrary terminal primitive to its correctly-tagged node --- LP4i's
 * construction-time fix for clause 3's root-in-nodes requirement. `rootId` is always one of
 * these five kinds for a host-bound graph (`rootId === hostId`), so every fresh-construction
 * factory below uses this to seed the root's own node alongside whatever else it builds.
 */
export const nodeFromId = (id: EphemeraLudicTerminalPrimitive): EphemeraLudicGraphNode => {
    if (isEphemeraCharacterId(id)) return characterNode(id)
    if (isEphemeraObjectId(id)) return objectNode(id)
    if (isEphemeraRoomId(id)) return roomNode(id)
    if (isEphemeraFeatureId(id)) return featureNode(id)
    if (isEphemeraAreaId(id)) return areaNode(id)
    throw new Error(`nodeFromId: unrecognized terminal primitive: ${id}`)
}

/**
 * BD-33/BD-35's assert-and-throw contract: thrown by `removeObject`/`removeCharacter`
 * when a relational edge still references the id being removed --- a dedicated upstream Assertion +
 * repair (`isolatedFromRelations`) was supposed to have severed it first via an explicit
 * `DissolveRelationStep`. Exported for `instanceof` checks in callers/tests.
 */
export class RelationalEdgeStillReferencedError extends Error {
    constructor(
        public readonly id: EphemeraObjectId | EphemeraCharacterId,
        public readonly hostId: EphemeraMembershipHostId
    ) {
        super(`${id} still has a relational edge on host ${hostId} --- an explicit DissolveRelationStep should have run first`)
        this.name = 'RelationalEdgeStillReferencedError'
    }
}

const extractPlayOnlyEdges = (envelope: PlayLudicGraph): PlayLudicGraph['edges'] => {
    const edges = envelope.edges ?? []
    const playOnly: NonNullable<PlayLudicGraph['edges']> = []
    for (const rawEdge of edges) {
        if (isEphemeraLudicRelationalEdgeData(rawEdge)) {
            continue
        }
        try {
            void new StandardExitEdge(rawEdge)
            playOnly.push(rawEdge)
        } catch {
            // ignore unknown edge shapes
        }
    }
    return playOnly.length > 0 ? playOnly : undefined
}

export class EphemeraLudicGraph {
    readonly hostId: EphemeraMembershipHostId
    /** The graph's designated root node, present in `nodes` (concepts clause 3). Recorded, never derived --- see this directory's `AGENT.md`. */
    readonly rootId: EphemeraLudicTerminalId

    private readonly _nodes: EphemeraLudicGraphNode[]
    private readonly _edges: EphemeraLudicRelationalEdgeData[] | undefined
    private readonly _playOnlyEdges: PlayLudicGraph['edges'] | undefined
    /** The egress list; required and possibly empty, deliberately with no read-boundary default. */
    private readonly _ports: EphemeraLudicGraphPort[]

    private constructor(
        hostId: EphemeraMembershipHostId,
        rootId: EphemeraLudicTerminalId,
        nodes: EphemeraLudicGraphNode[],
        edges: EphemeraLudicRelationalEdgeData[] | undefined,
        playOnlyEdges: PlayLudicGraph['edges'] | undefined = undefined,
        ports: EphemeraLudicGraphPort[] = []
    ) {
        this.hostId = hostId
        this.rootId = rootId
        this._nodes = nodes
        this._edges = edges
        this._playOnlyEdges = playOnlyEdges
        this._ports = ports
    }

    /**
     * A fresh empty host-bound graph is rooted at its own host (concepts clause 3), and the
     * root node itself is present in `nodes` --- LP4i's construction-time fix.
     */
    static empty(hostId: EphemeraMembershipHostId): EphemeraLudicGraph {
        return new EphemeraLudicGraph(hostId, hostId, [nodeFromId(hostId)], undefined, undefined, [])
    }

    static fromJSON(data: EphemeraLudicGraphData): EphemeraLudicGraph {
        return EphemeraLudicGraph.fromFieldPayload(data.hostId, {
            rootId: data.rootId,
            nodes: data.nodes,
            ...(data.edges !== undefined ? { edges: data.edges } : {}),
            ports: data.ports,
        })
    }

    /**
     * Plain-copies every node/edge (`{...node}`/`{...edge}`, not just `[...array]`) rather
     * than retaining `payload`'s own element references. This matters when `payload` comes
     * from an Immer `produce()` draft (every `MultiKeyUpdate` reducer in
     * `mtw-utilities/ts/dynamoDB/mixins/transact.ts` builds one) --- Immer revokes all draft
     * proxies synchronously the instant the reducer returns, so an `EphemeraLudicGraph`
     * that merely re-wrapped the draft's own node/edge objects would carry revoked proxies
     * the moment any caller retained it past the reducer's synchronous scope (e.g.
     * `applyObjectSetTransfer.ts` assigning `committedGraphs` from the reducer, for use by
     * the synchronous cache seed that runs after `transactWrite` resolves) --- "Cannot
     * perform 'get' on a proxy that has been revoked" on first property read. Node/edge
     * shapes are flat (`EphemeraLudicGraphNode`/`EphemeraLudicRelationalEdgeData` in
     * `mtw-interfaces/ts/ephemeraMeta.ts`), so a shallow per-element copy fully severs the
     * live reference.
     */
    static fromFieldPayload(
        hostId: EphemeraMembershipHostId,
        payload: EphemeraLudicGraphFieldPayload
    ): EphemeraLudicGraph {
        return new EphemeraLudicGraph(
            hostId,
            payload.rootId,
            payload.nodes.map((node) => ({ ...node })),
            payload.edges !== undefined ? payload.edges.map((edge) => ({ ...edge })) : undefined,
            undefined,
            payload.ports.map((port) => ({ ...port }))
        )
    }

    /**
     * Rooted at its own host --- a play envelope carries no independent root designation.
     * The root's own node is included alongside the extracted members (LP4i). An Object- or
     * Character-hosted graph's root shares its projected tag (Object/Character) with ordinary
     * members, so the envelope's own node list can already carry it (`toPlayEnvelope`'s
     * `projectComponentGraphFromStoredLudicGraph` keeps Character/Object nodes, drops
     * Room/Feature/Area) --- filtered out here to avoid double-adding it.
     */
    static fromPlayEnvelope(
        hostId: EphemeraMembershipHostId,
        envelope: PlayLudicGraph
    ): EphemeraLudicGraph {
        const relationalEdges = extractRelationalEdgesFromStored(envelope).map(toStoredRelationalEdge)
        const playOnlyEdges = extractPlayOnlyEdges(envelope)
        // A play envelope carries no port data (presentation lane, out of scope --- LP4d); ports are empty.
        return new EphemeraLudicGraph(
            hostId,
            hostId,
            [
                nodeFromId(hostId),
                ...extractCharacterIdsFromPlayLudicGraph(envelope).filter((id) => id !== hostId).map(characterNode),
                ...extractObjectIdsFromPlayLudicGraph(envelope).filter((id) => id !== hostId).map(objectNode),
            ],
            relationalEdges.length > 0 ? relationalEdges : undefined,
            playOnlyEdges,
            []
        )
    }

    get characterIds(): Set<EphemeraCharacterId> {
        return new Set(
            this._nodes
                .filter((node): node is { tag: 'Character'; universalKey: EphemeraCharacterId } => node.tag === 'Character')
                .map((node) => node.universalKey)
        )
    }

    get objectIds(): Set<EphemeraObjectId> {
        return new Set(
            this._nodes
                .filter((node): node is { tag: 'Object'; universalKey: EphemeraObjectId } => node.tag === 'Object')
                .map((node) => node.universalKey)
        )
    }

    /**
     * Every node's `universalKey`, regardless of tag --- a kind-indifferent presence/catalog
     * scan ("what's here to look at"), additive alongside the typed `characterIds`/`objectIds`
     * accessors rather than replacing them (see `AGENT.md`, Node model). Named `nodeIds`, not
     * `thingIds` --- the two sets still differ, though not for the reason they used to (LP4b
     * widened node tags to the full terminal-kind set, so Feature is a node now too):
     * `nodeIds` also admits Room/Area, which `EphemeraThingId` (a catalog/Identify-layer type,
     * not a graph-node type) does not.
     */
    get nodeIds(): Set<EphemeraLudicTerminalPrimitive> {
        return new Set(this._nodes.map((node) => node.universalKey))
    }

    get relationalEdges(): HostRelationalEdge[] {
        return extractRelationalEdgesFromStored(this.toStored())
    }

    /** The egress list --- inert until a producer exists (AB-55/AB-62, abstraction-layers plan). */
    get ports(): EphemeraLudicGraphPort[] {
        return [...this._ports]
    }

    toJSON(): EphemeraLudicGraphData {
        const stored = this.toStored()
        return {
            hostId: this.hostId,
            rootId: stored.rootId,
            nodes: stored.nodes,
            ...(stored.edges !== undefined ? { edges: stored.edges } : {}),
            ports: stored.ports,
        }
    }

    toStored(): EphemeraLudicGraphFieldPayload {
        return {
            rootId: this.rootId,
            nodes: [...this._nodes],
            ...(this._edges !== undefined ? { edges: [...this._edges] } : {}),
            ports: [...this._ports],
        }
    }

    toPlayEnvelope(): PlayLudicGraph {
        const projected = projectComponentGraphFromStoredLudicGraph(this.toStored())
        const playOnly = this._playOnlyEdges ?? []
        if (playOnly.length === 0) {
            return projected
        }
        return {
            ...projected,
            edges: [...(projected.edges ?? []), ...playOnly],
        }
    }

    clone(): EphemeraLudicGraph {
        return this
            .withNodes([...this._nodes])
            .withEdges(this._edges !== undefined ? [...this._edges] : undefined)
            .withPlayOnlyEdges(this._playOnlyEdges !== undefined ? [...this._playOnlyEdges] : undefined)
    }

    private withNodes(nodes: EphemeraLudicGraphNode[]): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this.rootId, nodes, this._edges, this._playOnlyEdges, this._ports)
    }

    private withEdges(edges: EphemeraLudicRelationalEdgeData[] | undefined): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this.rootId, this._nodes, edges, this._playOnlyEdges, this._ports)
    }

    private withPlayOnlyEdges(edges: PlayLudicGraph['edges'] | undefined): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this.rootId, this._nodes, this._edges, edges, this._ports)
    }

    private withPorts(ports: EphemeraLudicGraphPort[]): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this.rootId, this._nodes, this._edges, this._playOnlyEdges, ports)
    }

    private storedRelationalEdges(): HostRelationalEdge[] {
        return extractRelationalEdgesFromStored({ rootId: this.rootId, nodes: this._nodes, ...(this._edges !== undefined ? { edges: this._edges } : {}), ports: this._ports })
    }

    /**
     * **This comparison is still purely structural, and after P8 iteration 1 that makes it the
     * odd one out --- recorded rather than quietly left.** EA-10's survey names five sites that
     * use structure *as* identity; four of them compose `edgesMatch`, which now consults
     * `chainId`, and this is the fifth. It does its own field-by-field walk, so it did not
     * inherit the rule. **The consequence: two graphs alike but for their legs' chain
     * membership compare equal here and would not match leg-for-leg anywhere else.**
     *
     * **Not fixed in that slice deliberately, on two grounds.** P8 iteration 1's build surface
     * is deliberately minimal and widening it is what the Prototype's own discipline warns
     * against; and this method has **no non-test caller**, so the divergence is latent rather
     * than live. **The first non-test caller must close it** --- adding a `chainId` inequality
     * test to the edge loop below is the whole of the change.
     */
    equals(other: EphemeraLudicGraph): boolean {
        if (!(other instanceof EphemeraLudicGraph)) {
            return false
        }
        if (this.hostId !== other.hostId) {
            return false
        }
        if (!ephemeraLudicTerminalsEqual(this.rootId, other.rootId)) {
            return false
        }
        const a = this.toStored()
        const b = other.toStored()
        if (a.nodes.length !== b.nodes.length) {
            return false
        }
        for (let index = 0; index < a.nodes.length; index += 1) {
            const left = a.nodes[index]
            const right = b.nodes[index]
            if (left.tag !== right.tag || left.universalKey !== right.universalKey) {
                return false
            }
        }
        const aEdges = a.edges ?? []
        const bEdges = b.edges ?? []
        if (aEdges.length !== bEdges.length) {
            return false
        }
        for (let index = 0; index < aEdges.length; index += 1) {
            const left = aEdges[index]
            const right = bEdges[index]
            if (
                !ephemeraLudicTerminalsEqual(left.from, right.from)
                || !ephemeraLudicTerminalsEqual(left.to, right.to)
                || left.kind !== right.kind
            ) {
                return false
            }
            // Both sides are narrowed even though the kind equality above implies the second:
            // narrowing `left` does not narrow `right`, and only `Custom` carries a label at all.
            if (left.kind === 'Custom' && right.kind === 'Custom' && left.relationLabel !== right.relationLabel) {
                return false
            }
        }
        return true
    }

    addCharacter(characterId: EphemeraCharacterId): EphemeraLudicGraph {
        if (this.characterIds.has(characterId)) {
            return this
        }
        return this.withNodes([...this._nodes, characterNode(characterId)])
    }

    /**
     * BD-36's character half of the assert-and-throw contract --- vacuously satisfied today, since
     * `HostRelationalEdge` is `EphemeraObjectId`-typed and a character node can never be referenced
     * by one (the widening that would make this load-bearing, character-relation authoring, is
     * explicitly deferred; see `ludicGraph/AGENT.md` --- Known limitation (deferred)). No
     * edge-stripping of any kind follows the (currently vacuous) assert.
     */
    removeCharacter(characterId: EphemeraCharacterId): EphemeraLudicGraph {
        this.assertNoRelationalEdgesReferencing(characterId)
        return this.withNodes(
            this._nodes.filter((node) => !(node.tag === 'Character' && node.universalKey === characterId))
        )
    }

    addObject(objectId: EphemeraObjectId): EphemeraLudicGraph {
        if (this.objectIds.has(objectId)) {
            return this
        }
        return this.withNodes([...this._nodes, objectNode(objectId)])
    }

    /**
     * BD-33/BD-35 assert-and-throw contract: checks no relational edge still references `objectId`
     * (throwing `RelationalEdgeStillReferencedError` if one does, since an explicit
     * `DissolveRelationStep` should have run first) rather than silently stripping it, as the
     * retired plain `removeObject`/`applyTransferSet.ts`/`applyMembershipEffect` (deleted 2026-07-23,
     * once `applyHostEffects` --- their last live caller --- retired) used to. Play-only/exit edges
     * are a distinct invariant, untouched by this contract --- they keep the old silent-strip
     * behavior here too, since nothing upstream of them establishes a dissolve-first contract for
     * those edges. (Renamed from `removeObjectAsserted` 2026-07-23, once the plain silent-strip
     * `removeObject` it was disambiguated from was itself deleted --- this is the only
     * implementation now.)
     */
    removeObject(objectId: EphemeraObjectId): EphemeraLudicGraph {
        this.assertNoRelationalEdgesReferencing(objectId)
        const withoutNode = this.withNodes(
            this._nodes.filter((node) => !(node.tag === 'Object' && node.universalKey === objectId))
        )
        return withoutNode.withoutPlayOnlyEdgesReferencingObject(objectId)
    }

    private assertNoRelationalEdgesReferencing(id: EphemeraObjectId | EphemeraCharacterId): void {
        if (this.relationalEdges.some((edge) => ephemeraLudicTerminalRefersTo(edge.from, id) || ephemeraLudicTerminalRefersTo(edge.to, id))) {
            throw new RelationalEdgeStillReferencedError(id, this.hostId)
        }
    }

    private withoutPlayOnlyEdgesReferencingObject(objectId: EphemeraObjectId): EphemeraLudicGraph {
        if (this._playOnlyEdges === undefined) {
            return this
        }
        const filtered = this._playOnlyEdges.filter((edge) => !edgeReferencesObjectId(edge, objectId))
        return this.withPlayOnlyEdges(filtered.length > 0 ? filtered : undefined)
    }

    addRelationalEdge(edge: HostRelationalEdge): EphemeraLudicGraph {
        const stored = this.storedRelationalEdges()
        if (stored.some((candidate) => edgesMatch(candidate, edge))) {
            return this
        }
        return this.withEdges([...(this._edges ?? []), toStoredRelationalEdge(edge)])
    }

    removeRelationalEdge(edge: HostRelationalEdge): EphemeraLudicGraph {
        return this.withEdges(
            this.storedRelationalEdges()
                .filter((existing) => !edgesMatch(existing, edge))
                .map(toStoredRelationalEdge)
        )
    }

    addPort(port: EphemeraLudicGraphPort): EphemeraLudicGraph {
        if (this._ports.some((existing) => existing.portId === port.portId)) {
            return this
        }
        return this.withPorts([...this._ports, port])
    }

    removePort(portId: string): EphemeraLudicGraph {
        return this.withPorts(this._ports.filter((port) => port.portId !== portId))
    }

    /**
     * Node presence is always keyed by the owning component, never by a port, so a
     * port-qualified terminal is resolved to its owner before the membership check
     * (LP3/PQ-10). `from`/`to` are `EphemeraLudicTerminalId`-typed (LP4/LP7) --- any legal
     * host-kind component, or a port-qualified reference on one, not only Objects --- so
     * presence is checked against every node's `universalKey` (`nodeIds`), not only
     * `objectIds`. Despite the name (kept for callers; see `AGENT.md`'s "Relational edge
     * names"), this has always been a node-presence check, not an object-only one, once a
     * non-Object terminal can appear.
     */
    bothObjectsOnGraph(from: EphemeraLudicTerminalId, to: EphemeraLudicTerminalId): boolean {
        const nodeIds = this.nodeIds
        return nodeIds.has(ephemeraLudicTerminalOwner(from)) && nodeIds.has(ephemeraLudicTerminalOwner(to))
    }

    nodeHasRelationalEdge(nodeId: EphemeraLudicTerminalPrimitive): boolean {
        return nodeHasRelationalEdge(nodeId, this.relationalEdges)
    }

    applyRelationalPatch(patch: HostRelationalPatch): EphemeraLudicGraph {
        if (patch.hostId !== this.hostId) {
            throw new Error(`HostRelationalPatch hostId ${patch.hostId} does not match graph hostId ${this.hostId}`)
        }
        // The `Custom relational edge requires relationLabel` throw that used to stand here is
        // gone: `HostRelationalEdge` now carries the label on its `Custom` arm, so a patch that
        // omits it does not typecheck and the runtime check had become unreachable.
        if (!this.bothObjectsOnGraph(patch.edge.from, patch.edge.to)) {
            throw new Error(`Nodes ${patch.edge.from} and/or ${patch.edge.to} not on host ${patch.hostId}`)
        }

        // `manipulation/types.ts`'s mirror and this module's are structurally identical, so the
        // field-by-field rebuild this used to do was a copy in all but name.
        const observedEdge: HostRelationalEdge = patch.edge
        const matchingEdge = this.relationalEdges.find((edge) => edgesMatch(edge, observedEdge))

        if (patch.op === 'add') {
            if (matchingEdge) {
                return this
            }
            return this.addRelationalEdge(observedEdge)
        }
        if (!matchingEdge) {
            throw new Error(`Cannot remove relational edge ${patch.edge.from} -> ${patch.edge.to} on ${patch.hostId}: not present`)
        }
        return this.removeRelationalEdge(observedEdge)
    }
}

export const seedFromActiveCharacters = (
    activeCharacters: EphemeraRoomActiveCharacter[],
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph =>
    EphemeraLudicGraph.fromFieldPayload(hostId, {
        rootId: hostId,
        nodes: [nodeFromId(hostId), ...activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId))],
        edges: [],
        ports: [],
    })

export const fromRoomMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => {
    const record = meta as {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    }
    if (record.ludicGraph) {
        return EphemeraLudicGraph.fromFieldPayload(hostId, record.ludicGraph)
    }
    return seedFromActiveCharacters(record.activeCharacters ?? [], hostId)
}

/**
 * MD-1(c)'s shared plain serde: a direct `ludicGraph` field read with a trivial empty default,
 * no reconstruction from any second source. Every non-Room host kind (Character; Object as of MK2;
 * Feature as of MK3; Area as of MK4) is this same body --- `fromCharacterMeta`/`fromObjectMeta`/
 * `fromFeatureMeta`/`fromAreaMeta` are thin, host-named wrappers around it, not independent
 * implementations.
 */
const fromPlainHostMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => {
    const record = meta as { ludicGraph?: EphemeraLudicGraphFieldPayload }
    return EphemeraLudicGraph.fromFieldPayload(hostId, record.ludicGraph ?? { rootId: hostId, nodes: [nodeFromId(hostId)], edges: [], ports: [] })
}

export const fromCharacterMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => fromPlainHostMeta(meta, hostId)

export const fromObjectMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => fromPlainHostMeta(meta, hostId)

export const fromFeatureMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => fromPlainHostMeta(meta, hostId)

export const fromAreaMeta = (
    meta: {
        ludicGraph?: EphemeraLudicGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraLudicGraph => fromPlainHostMeta(meta, hostId)

/**
 * Shared Room/Character/Object/Feature/Area dispatch for kernel primitives that read/write a
 * host's `Meta::Room`/`Meta::Character`/`Meta::Object`/`Meta::Feature`/`Meta::Area` record
 * directly (`MultiKeyUpdate` reducers). Promoted here (2026-07-15, BD-15/16 slice 3) once a third
 * call site (`applyHostRelationalPatch.ts`) needed the exact same pair already duplicated
 * in `applyObjectSetTransfer.ts`. Dispatches all five `EphemeraMembershipHostId` kinds.
 */
export const hostDataCategory = (hostId: EphemeraMembershipHostId): 'Meta::Room' | 'Meta::Character' | 'Meta::Object' | 'Meta::Feature' | 'Meta::Area' =>
    isEphemeraRoomId(hostId)
        ? 'Meta::Room'
        : isEphemeraObjectId(hostId)
        ? 'Meta::Object'
        : isEphemeraFeatureId(hostId)
        ? 'Meta::Feature'
        : isEphemeraAreaId(hostId)
        ? 'Meta::Area'
        : 'Meta::Character'

export const graphFromMeta = (meta: Record<string, unknown>, hostId: EphemeraMembershipHostId): EphemeraLudicGraph => {
    if (isEphemeraRoomId(hostId)) {
        return fromRoomMeta(meta, hostId)
    }
    if (isEphemeraObjectId(hostId)) {
        return fromObjectMeta(meta, hostId)
    }
    if (isEphemeraFeatureId(hostId)) {
        return fromFeatureMeta(meta, hostId)
    }
    if (isEphemeraAreaId(hostId)) {
        return fromAreaMeta(meta, hostId)
    }
    return fromCharacterMeta(meta, hostId)
}
