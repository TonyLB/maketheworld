import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import {
    extractCharacterIdsFromPlayPositionGraph,
    extractObjectIdsFromPlayPositionGraph,
    projectComponentGraphFromStoredPositionGraph,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type {
    EphemeraPositionGraphData,
    EphemeraPositionGraphFieldPayload,
    EphemeraPositionGraphNode,
    EphemeraPositionRelationalEdgeData,
    EphemeraRoomActiveCharacter,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'

import type { HostEffect, HostRelationalPatch } from '../manipulation/types'
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

export const characterNode = (universalKey: EphemeraCharacterId): EphemeraPositionGraphNode => ({
    tag: 'Character',
    universalKey,
})

export const objectNode = (universalKey: EphemeraObjectId): EphemeraPositionGraphNode => ({
    tag: 'Object',
    universalKey,
})

const extractPlayOnlyEdges = (envelope: PlayPositionGraph): PlayPositionGraph['edges'] => {
    const edges = envelope.edges ?? []
    const playOnly: NonNullable<PlayPositionGraph['edges']> = []
    for (const rawEdge of edges) {
        if (isEphemeraPositionRelationalEdgeData(rawEdge)) {
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

export class EphemeraPositionGraph {
    readonly hostId: EphemeraMembershipHostId

    private readonly _nodes: EphemeraPositionGraphNode[]
    private readonly _edges: EphemeraPositionRelationalEdgeData[] | undefined
    private readonly _playOnlyEdges: PlayPositionGraph['edges'] | undefined

    private constructor(
        hostId: EphemeraMembershipHostId,
        nodes: EphemeraPositionGraphNode[],
        edges: EphemeraPositionRelationalEdgeData[] | undefined,
        playOnlyEdges: PlayPositionGraph['edges'] | undefined = undefined
    ) {
        this.hostId = hostId
        this._nodes = nodes
        this._edges = edges
        this._playOnlyEdges = playOnlyEdges
    }

    static empty(hostId: EphemeraMembershipHostId): EphemeraPositionGraph {
        return new EphemeraPositionGraph(hostId, [], undefined)
    }

    static fromJSON(data: EphemeraPositionGraphData): EphemeraPositionGraph {
        return EphemeraPositionGraph.fromFieldPayload(data.hostId, {
            nodes: data.nodes,
            ...(data.edges !== undefined ? { edges: data.edges } : {}),
        })
    }

    static fromFieldPayload(
        hostId: EphemeraMembershipHostId,
        payload: EphemeraPositionGraphFieldPayload
    ): EphemeraPositionGraph {
        return new EphemeraPositionGraph(
            hostId,
            payload.nodes,
            payload.edges !== undefined ? [...payload.edges] : undefined
        )
    }

    static fromPlayEnvelope(
        hostId: EphemeraMembershipHostId,
        envelope: PlayPositionGraph
    ): EphemeraPositionGraph {
        const relationalEdges = extractRelationalEdgesFromStored(envelope).map(toStoredRelationalEdge)
        const playOnlyEdges = extractPlayOnlyEdges(envelope)
        return new EphemeraPositionGraph(
            hostId,
            [
                ...extractCharacterIdsFromPlayPositionGraph(envelope).map(characterNode),
                ...extractObjectIdsFromPlayPositionGraph(envelope).map(objectNode),
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

    toJSON(): EphemeraPositionGraphData {
        const stored = this.toStored()
        return {
            hostId: this.hostId,
            nodes: stored.nodes,
            ...(stored.edges !== undefined ? { edges: stored.edges } : {}),
        }
    }

    toStored(): EphemeraPositionGraphFieldPayload {
        return {
            nodes: [...this._nodes],
            ...(this._edges !== undefined ? { edges: [...this._edges] } : {}),
        }
    }

    toPlayEnvelope(): PlayPositionGraph {
        const projected = projectComponentGraphFromStoredPositionGraph(this.toStored())
        const playOnly = this._playOnlyEdges ?? []
        if (playOnly.length === 0) {
            return projected
        }
        return {
            ...projected,
            edges: [...(projected.edges ?? []), ...playOnly],
        }
    }

    clone(): EphemeraPositionGraph {
        return this
            .withNodes([...this._nodes])
            .withEdges(this._edges !== undefined ? [...this._edges] : undefined)
            .withPlayOnlyEdges(this._playOnlyEdges !== undefined ? [...this._playOnlyEdges] : undefined)
    }

    private withNodes(nodes: EphemeraPositionGraphNode[]): EphemeraPositionGraph {
        return new EphemeraPositionGraph(this.hostId, nodes, this._edges, this._playOnlyEdges)
    }

    private withEdges(edges: EphemeraPositionRelationalEdgeData[] | undefined): EphemeraPositionGraph {
        return new EphemeraPositionGraph(this.hostId, this._nodes, edges, this._playOnlyEdges)
    }

    private withPlayOnlyEdges(edges: PlayPositionGraph['edges'] | undefined): EphemeraPositionGraph {
        return new EphemeraPositionGraph(this.hostId, this._nodes, this._edges, edges)
    }

    private storedRelationalEdges(): HostRelationalEdge[] {
        return extractRelationalEdgesFromStored({ nodes: this._nodes, ...(this._edges !== undefined ? { edges: this._edges } : {}) })
    }

    equals(other: EphemeraPositionGraph): boolean {
        if (!(other instanceof EphemeraPositionGraph)) {
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

    addCharacter(characterId: EphemeraCharacterId): EphemeraPositionGraph {
        if (this.characterIds.has(characterId)) {
            return this
        }
        return this.withNodes([...this._nodes, characterNode(characterId)])
    }

    removeCharacter(characterId: EphemeraCharacterId): EphemeraPositionGraph {
        return this.withNodes(
            this._nodes.filter((node) => !(node.tag === 'Character' && node.universalKey === characterId))
        )
    }

    addObject(objectId: EphemeraObjectId): EphemeraPositionGraph {
        if (this.objectIds.has(objectId)) {
            return this
        }
        return this.withNodes([...this._nodes, objectNode(objectId)])
    }

    removeObject(objectId: EphemeraObjectId): EphemeraPositionGraph {
        const withoutNode = this.withNodes(
            this._nodes.filter((node) => !(node.tag === 'Object' && node.universalKey === objectId))
        )
        return withoutNode.withoutEdgesReferencingObject(objectId)
    }

    private withoutEdgesReferencingObject(objectId: EphemeraObjectId): EphemeraPositionGraph {
        let graph: EphemeraPositionGraph = this
        if (this._edges !== undefined) {
            const filtered = this._edges.filter((edge) => !edgeReferencesObjectId(edge, objectId))
            graph = graph.withEdges(filtered)
        }
        if (this._playOnlyEdges !== undefined) {
            const filtered = this._playOnlyEdges.filter((edge) => !edgeReferencesObjectId(edge, objectId))
            graph = graph.withPlayOnlyEdges(filtered.length > 0 ? filtered : undefined)
        }
        return graph
    }

    addRelationalEdge(edge: HostRelationalEdge): EphemeraPositionGraph {
        const stored = this.storedRelationalEdges()
        if (stored.some((candidate) => edgesMatch(candidate, edge))) {
            return this
        }
        return this.withEdges([...(this._edges ?? []), toStoredRelationalEdge(edge)])
    }

    removeRelationalEdge(edge: HostRelationalEdge): EphemeraPositionGraph {
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

    applyMembershipEffect(effect: HostEffect): EphemeraPositionGraph {
        if (effect.hostId !== this.hostId) {
            throw new Error(`HostEffect hostId ${effect.hostId} does not match graph hostId ${this.hostId}`)
        }
        if (isEphemeraRoomId(effect.hostId)) {
            if (effect.identityId.startsWith('CHARACTER#')) {
                return effect.op === 'remove'
                    ? this.removeCharacter(effect.identityId as EphemeraCharacterId)
                    : this.addCharacter(effect.identityId as EphemeraCharacterId)
            }
            return effect.op === 'remove'
                ? this.removeObject(effect.identityId as EphemeraObjectId)
                : this.addObject(effect.identityId as EphemeraObjectId)
        }
        return effect.op === 'remove'
            ? this.removeObject(effect.identityId as EphemeraObjectId)
            : this.addObject(effect.identityId as EphemeraObjectId)
    }

    applyRelationalPatch(patch: HostRelationalPatch): EphemeraPositionGraph {
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
): EphemeraPositionGraph =>
    EphemeraPositionGraph.fromFieldPayload(hostId, {
        nodes: activeCharacters.map(({ EphemeraId }) => characterNode(EphemeraId)),
        edges: [],
    })

export const fromRoomMeta = (
    meta: {
        positionGraph?: EphemeraPositionGraphFieldPayload;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraPositionGraph => {
    const record = meta as {
        positionGraph?: EphemeraPositionGraphFieldPayload;
        activeCharacters?: EphemeraRoomActiveCharacter[];
    }
    if (record.positionGraph) {
        return EphemeraPositionGraph.fromFieldPayload(hostId, record.positionGraph)
    }
    return seedFromActiveCharacters(record.activeCharacters ?? [], hostId)
}

export const fromCharacterMeta = (
    meta: {
        positionGraph?: EphemeraPositionGraphFieldPayload;
    } | Record<string, unknown>,
    hostId: EphemeraMembershipHostId
): EphemeraPositionGraph => {
    const record = meta as { positionGraph?: EphemeraPositionGraphFieldPayload }
    return EphemeraPositionGraph.fromFieldPayload(hostId, record.positionGraph ?? { nodes: [], edges: [] })
}

/**
 * Shared Room/Character dispatch for kernel primitives that read/write a host's
 * `Meta::Room`/`Meta::Character` record directly (`MultiKeyUpdate` reducers).
 * Promoted here (2026-07-15, BD-15/16 slice 3) once a third call site
 * (`applyHostRelationalPatch.ts`) needed the exact same pair already duplicated
 * in `applyObjectSetTransfer.ts`.
 */
export const hostDataCategory = (hostId: EphemeraMembershipHostId): 'Meta::Room' | 'Meta::Character' =>
    isEphemeraRoomId(hostId) ? 'Meta::Room' : 'Meta::Character'

export const graphFromMeta = (meta: Record<string, unknown>, hostId: EphemeraMembershipHostId): EphemeraPositionGraph =>
    isEphemeraRoomId(hostId) ? fromRoomMeta(meta, hostId) : fromCharacterMeta(meta, hostId)
