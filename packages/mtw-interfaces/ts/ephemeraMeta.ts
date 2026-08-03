import { checkTypes } from './utils'
import {
    isEphemeraRoomId,
    type EphemeraRoomId,
    isEphemeraCharacterId,
    type EphemeraCharacterId,
    isEphemeraObjectId,
    type EphemeraObjectId,
} from './baseClasses'
import { areCoyoteObjectTropeFieldsValid, type CoyoteTropeAffinity } from './coyotePlanAffinities'
import {
    isEphemeraMembershipHostId,
    type EphemeraMembershipHostId,
} from './ephemeraPositionAdjacency'

//
// Shared types for Ephemera-table metadata records (ephemeraDB).
//
// Note: This is intentionally distinct from assetDB's `Meta::Room` records (which are used
// for cross-asset indexing, e.g. the `cached` asset list).
//

//
// Render-cache Mark state (shared with state system + preview + cache records)
//

export type EphemeraCacheMarkValue = {
    mark: string;
    value: string;
}

export type EphemeraCacheMarkState = {
    markValue: EphemeraCacheMarkValue[];
}

export type EphemeraPerspectiveKey = string
export type EphemeraCacheId = `CACHE#${string}`

export const isEphemeraCacheMarkState = (value: any): value is EphemeraCacheMarkState => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.markValue)) {
        return false
    }
    return value.markValue.every((entry: any) => (
        entry
        && typeof entry === 'object'
        && typeof entry.mark === 'string'
        && typeof entry.value === 'string'
    ))
}

//
// Ephemera-table `Meta::Room` record (ephemeraDB)
//

export type EphemeraRoomState = {
    marks: EphemeraCacheMarkState;
    situationId?: string;
}

export type EphemeraRoomActiveCharacter = {
    EphemeraId: EphemeraCharacterId;
    DisplayName?: string;
    Name?: string;
    Color?: string;
    fileURL?: string;
    ConnectionIds?: string[];
    SessionIds?: string[];
    sessions?: string[];
}

/** Objects Change ingress add-row / affordance wire compose shape (not persisted on Meta::Room).
 *  At persist: shortName -> improvisation pair; stableKey + trope fields -> Meta::Object. */
export type EphemeraMetaRoomObject = {
    uuid: EphemeraObjectId;
    shortName: string;
    /** Coyote-wide machine correlation key (`a-z` / `0-9` / `-`). */
    stableKey: string;
    /** Canonical trope-centered possibilities for Coyote planning (1-3 entries; six tropes incl. Scene Dressing). */
    tropeAffinities?: CoyoteTropeAffinity[];
    /** True when trope affinities were unavailable from enrich processing. */
    tropeAffinitiesFailed?: boolean;
}

export const isEphemeraMetaRoomObject = (entry: unknown): entry is EphemeraMetaRoomObject => {
    if (
        typeof entry !== 'object'
        || entry === null
        || !('uuid' in entry)
        || !('shortName' in entry)
        || typeof (entry as EphemeraMetaRoomObject).shortName !== 'string'
        || !isEphemeraObjectId((entry as EphemeraMetaRoomObject).uuid)
    ) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (!areCoyoteObjectTropeFieldsValid(o)) {
        return false
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    return true
}

//
// First-class improvisational objects (shipped steady state)
//
// ADR: three-way split mirrors Character --- merge body on component pair row,
// play meta on Meta::Object, placement on positionGraph + POSITION#ROOM adjacency.
// Optional fourth adjacency row (EMBEDDING#IMPROMPTU): see ephemeraEmbedding.ts.
//
// - One component pair row (OBJECT#, ASSET#...) + one (OBJECT#, Meta::Object) per spawned object.
//   v1 writes use ASSET#IMPROVISATION as DataCategory; type does not hard-code that layer.
// - shortName lives only on the pair row (StandardObject JSON), alongside an optional
//   SITUATION#DEFAULT situations facet (Acme-generated flavor-text prose at spawn,
//   lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts); never on Meta::Object.
// - stableKey / trope fields live only on EphemeraMetaObject.
// - Spawn/clear coordinators write or delete both rows in one transact.
//
// Pair merge-body shape: ComponentPairPersistedFields / EphemeraDbGetItemsComponentRow in
// @tonylb/mtw-gateways/ts/assets/components/componentData/fetch.ts (not duplicated here).
//

/** ephemeraDB play meta for OBJECT#; does not participate in asset-stack merge (I2). */
export type EphemeraMetaObject = {
    EphemeraId: EphemeraObjectId;
    DataCategory: 'Meta::Object';
    /** Coyote-wide machine correlation key (`a-z` / `0-9` / `-`). */
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}

export const isEphemeraMetaObject = (entry: unknown): entry is EphemeraMetaObject => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const o = entry as Record<string, unknown>
    if (typeof o.EphemeraId !== 'string' || !isEphemeraObjectId(o.EphemeraId) || o.DataCategory !== 'Meta::Object') {
        return false
    }
    if (!areCoyoteObjectTropeFieldsValid(o)) {
        return false
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    if ('shortName' in o || 'uuid' in o) {
        return false
    }
    return true
}

/** Slice 2 v1 shipped Character nodes; Phase 4 shipped Object nodes (nodes only). */
export type EphemeraPositionGraphNode =
    | {
        tag: 'Character';
        universalKey: EphemeraCharacterId;
    }
    | {
        tag: 'Object';
        universalKey: EphemeraObjectId;
    }

export type HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'

/** In-host relational edge on room positionGraph (Phase B establishRelation / dissolveRelation). */
export type EphemeraPositionRelationalEdgeData = {
    tag: 'Relational';
    from: EphemeraObjectId;
    to: EphemeraObjectId;
    kind: HostRelationalEdgeKind;
    relationLabel?: string;
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom'])

export const isEphemeraPositionRelationalEdgeData = (value: unknown): value is EphemeraPositionRelationalEdgeData => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const edge = value as EphemeraPositionRelationalEdgeData
    if (edge.tag !== 'Relational') {
        return false
    }
    if (!isEphemeraObjectId(edge.from) || !isEphemeraObjectId(edge.to)) {
        return false
    }
    if (!HOST_RELATIONAL_EDGE_KINDS.has(edge.kind)) {
        return false
    }
    if (edge.kind === 'Custom') {
        return typeof edge.relationLabel === 'string' && edge.relationLabel.length > 0
    }
    if (edge.relationLabel !== undefined && typeof edge.relationLabel !== 'string') {
        return false
    }
    return true
}

/** Host-bound play manipulation JSON (includes hostId). Assemble at Dynamo read boundary. */
export type EphemeraPositionGraphData = {
    hostId: EphemeraMembershipHostId;
    nodes: EphemeraPositionGraphNode[];
    /** Phase B: in-host relational edges on room host graphs; absent or [] when none. */
    edges?: EphemeraPositionRelationalEdgeData[];
}

/** Value of Meta::*.positionGraph attribute only (hostId omitted; row EphemeraId is authoritative). */
export type EphemeraPositionGraphFieldPayload = Omit<EphemeraPositionGraphData, 'hostId'>

export const isEphemeraPositionGraphNode = (value: unknown): value is EphemeraPositionGraphNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as EphemeraPositionGraphNode
    if ('key' in entry) {
        return false
    }
    if (entry.tag === 'Character') {
        return isEphemeraCharacterId(entry.universalKey)
    }
    if (entry.tag === 'Object') {
        return isEphemeraObjectId(entry.universalKey)
    }
    return false
}

export const isEphemeraPositionGraphFieldPayload = (value: unknown): value is EphemeraPositionGraphFieldPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraPositionGraphFieldPayload
    if (!Array.isArray(graph.nodes)) {
        return false
    }
    if (!graph.nodes.every((entry) => isEphemeraPositionGraphNode(entry))) {
        return false
    }
    if ('edges' in graph) {
        const edges = graph.edges
        if (!Array.isArray(edges) || !edges.every((entry) => isEphemeraPositionRelationalEdgeData(entry))) {
            return false
        }
    }
    return true
}

export const isEphemeraPositionGraphData = (value: unknown): value is EphemeraPositionGraphData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraPositionGraphData
    if (typeof graph.hostId !== 'string' || !isEphemeraMembershipHostId(graph.hostId)) {
        return false
    }
    return isEphemeraPositionGraphFieldPayload(graph)
}

export type EphemeraMetaRoom = {
    EphemeraId: EphemeraRoomId;
    DataCategory: 'Meta::Room';

    //
    // Existing field used for presence lists and room updates.
    //
    activeCharacters?: EphemeraRoomActiveCharacter[];

    //
    // Play-time membership graph (slice 2+ authority). Character + Object nodes shipped (Object: nodes only).
    //
    positionGraph?: EphemeraPositionGraphFieldPayload;

    //
    // v1 world-state fields for state-driven, cache-backed Room rendering.
    //
    state?: EphemeraRoomState;
}

export const isEphemeraMetaRoom = (value: any): value is EphemeraMetaRoom => {
    if (!value || typeof value !== 'object') {
        return false
    }
    if (!checkTypes(value, { EphemeraId: 'string', DataCategory: 'string' })) {
        return false
    }
    if (!isEphemeraRoomId(value.EphemeraId) || value.DataCategory !== 'Meta::Room') {
        return false
    }
    if ('state' in value) {
        const state = value.state
        if (!state || typeof state !== 'object') {
            return false
        }
        if (!('marks' in state) || !isEphemeraCacheMarkState(state.marks)) {
            return false
        }
        if ('situationId' in state && typeof state.situationId !== 'string') {
            return false
        }
    }
    if ('activeCharacters' in value) {
        const activeCharacters = value.activeCharacters
        if (!Array.isArray(activeCharacters)) {
            return false
        }
        const ok = activeCharacters.every((entry: any) => (
            entry
            && typeof entry === 'object'
            && checkTypes(entry, { EphemeraId: 'string' }, {
                DisplayName: 'string',
                Name: 'string',
                Color: 'string',
                fileURL: 'string'
            })
            && isEphemeraCharacterId(entry.EphemeraId)
        ))
        if (!ok) {
            return false
        }
    }
    if ('objects' in value) {
        return false
    }
    if ('positionGraph' in value && !isEphemeraPositionGraphFieldPayload(value.positionGraph)) {
        return false
    }
    return true
}

//
// Partial projection of the ephemeraDB `Meta::Character` row (same PK/SK as presentation meta).
//
// The full row also carries `RoomStack`, `Name`, `HomeId`, `assets`, and other fields typed for
// lambda `CharacterMeta` / eviction-ladder reads --- not duplicated here. This interface names
// only the positions-owned slice we validate on Dynamo fetch (e.g. `getCharacterPositionGraphFromDynamo`
// projects `positionGraph` via `Pick<EphemeraMetaCharacter, 'positionGraph'>`). Do not treat the
// type name as a complete meta document shape.
//
export type EphemeraMetaCharacter = {
    EphemeraId: EphemeraCharacterId;
    DataCategory: 'Meta::Character';

    //
    // Play-time inventory graph (D16 / character host). v1: Object membership nodes only.
    //
    positionGraph?: EphemeraPositionGraphFieldPayload;
}

/** Validates the positions slice of a `Meta::Character` row; does not assert presentation / ladder fields. */
export const isEphemeraMetaCharacter = (value: any): value is EphemeraMetaCharacter => {
    if (!value || typeof value !== 'object') {
        return false
    }
    if (!checkTypes(value, { EphemeraId: 'string', DataCategory: 'string' })) {
        return false
    }
    if (!isEphemeraCharacterId(value.EphemeraId) || value.DataCategory !== 'Meta::Character') {
        return false
    }
    if ('positionGraph' in value) {
        const positionGraph = value.positionGraph
        if (!isEphemeraPositionGraphFieldPayload(positionGraph)) {
            return false
        }
        const hasCharacterNode = positionGraph.nodes.some((node) => node.tag === 'Character')
        if (hasCharacterNode) {
            return false
        }
    }
    return true
}

