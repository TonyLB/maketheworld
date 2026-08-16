import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    extractCharacterIdsFromPlayLudicGraph,
    extractObjectIdsFromPlayLudicGraph,
    projectComponentGraphFromStoredLudicGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type {
    EphemeraLudicGraphData,
    EphemeraLudicGraphFieldPayload,
    EphemeraLudicGraphNode,
    EphemeraLudicRelationalEdgeData,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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

    private readonly _nodes: EphemeraLudicGraphNode[]
    private readonly _edges: EphemeraLudicRelationalEdgeData[] | undefined
    private readonly _playOnlyEdges: PlayLudicGraph['edges'] | undefined

    private constructor(
        hostId: EphemeraMembershipHostId,
        nodes: EphemeraLudicGraphNode[],
        edges: EphemeraLudicRelationalEdgeData[] | undefined,
        playOnlyEdges: PlayLudicGraph['edges'] | undefined = undefined
    ) {
        this.hostId = hostId
        this._nodes = nodes
        this._edges = edges
        this._playOnlyEdges = playOnlyEdges
    }

    static empty(hostId: EphemeraMembershipHostId): EphemeraLudicGraph {
        return new EphemeraLudicGraph(hostId, [], undefined)
    }

    static fromJSON(data: EphemeraLudicGraphData): EphemeraLudicGraph {
        return EphemeraLudicGraph.fromFieldPayload(data.hostId, {
            nodes: data.nodes,
            ...(data.edges !== undefined ? { edges: data.edges } : {}),
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
            payload.nodes.map((node) => ({ ...node })),
            payload.edges !== undefined ? payload.edges.map((edge) => ({ ...edge })) : undefined
        )
    }

    static fromPlayEnvelope(
        hostId: EphemeraMembershipHostId,
        envelope: PlayLudicGraph
    ): EphemeraLudicGraph {
        const relationalEdges = extractRelationalEdgesFromStored(envelope).map(toStoredRelationalEdge)
        const playOnlyEdges = extractPlayOnlyEdges(envelope)
        return new EphemeraLudicGraph(
            hostId,
            [
                ...extractCharacterIdsFromPlayLudicGraph(envelope).map(characterNode),
                ...extractObjectIdsFromPlayLudicGraph(envelope).map(objectNode),
            ],
            relationalEdges.length > 0 ? relationalEdges : undefined,
            playOnlyEdges
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

    get relationalEdges(): HostRelationalEdge[] {
        return extractRelationalEdgesFromStored(this.toStored())
    }

    toJSON(): EphemeraLudicGraphData {
        const stored = this.toStored()
        return {
            hostId: this.hostId,
            nodes: stored.nodes,
            ...(stored.edges !== undefined ? { edges: stored.edges } : {}),
        }
    }

    toStored(): EphemeraLudicGraphFieldPayload {
        return {
            nodes: [...this._nodes],
            ...(this._edges !== undefined ? { edges: [...this._edges] } : {}),
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
        return new EphemeraLudicGraph(this.hostId, nodes, this._edges, this._playOnlyEdges)
    }

    private withEdges(edges: EphemeraLudicRelationalEdgeData[] | undefined): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this._nodes, edges, this._playOnlyEdges)
    }

    private withPlayOnlyEdges(edges: PlayLudicGraph['edges'] | undefined): EphemeraLudicGraph {
        return new EphemeraLudicGraph(this.hostId, this._nodes, this._edges, edges)
    }

    private storedRelationalEdges(): HostRelationalEdge[] {
        return extractRelationalEdgesFromStored({ nodes: this._nodes, ...(this._edges !== undefined ? { edges: this._edges } : {}) })
    }

    equals(other: EphemeraLudicGraph): boolean {
        if (!(other instanceof EphemeraLudicGraph)) {
            return false
        }
        if (this.hostId !== other.hostId) {
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
                left.from !== right.from
                || left.to !== right.to
                || left.kind !== right.kind
                || left.relationLabel !== right.relationLabel
            ) {
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
        if (this.relationalEdges.some((edge) => edge.from === id || edge.to === id)) {
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

    bothObjectsOnGraph(from: EphemeraObjectId, to: EphemeraObjectId): boolean {
        const objectIds = this.objectIds
        return objectIds.has(from) && objectIds.has(to)
    }

    nodeHasRelationalEdge(nodeId: EphemeraObjectId): boolean {
        return nodeHasRelationalEdge(nodeId, this.relationalEdges)
    }

    applyRelationalPatch(patch: HostRelationalPatch): EphemeraLudicGraph {
        if (patch.hostId !== this.hostId) {
            throw new Error(`HostRelationalPatch hostId ${patch.hostId} does not match graph hostId ${this.hostId}`)
        }
        if (patch.edge.kind === 'Custom' && typeof patch.edge.relationLabel !== 'string') {
            throw new Error('Custom relational edge requires relationLabel')
        }
        if (!this.bothObjectsOnGraph(patch.edge.from, patch.edge.to)) {
            throw new Error(`Nodes ${patch.edge.from} and/or ${patch.edge.to} not on host ${patch.hostId}`)
        }

        const observedEdge: HostRelationalEdge = {
            from: patch.edge.from,
            to: patch.edge.to,
            kind: patch.edge.kind,
            ...(patch.edge.relationLabel !== undefined ? { relationLabel: patch.edge.relationLabel } : {}),
        }
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
        nodes: activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId)),
        edges: [],
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
    return EphemeraLudicGraph.fromFieldPayload(hostId, record.ludicGraph ?? { nodes: [], edges: [] })
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
