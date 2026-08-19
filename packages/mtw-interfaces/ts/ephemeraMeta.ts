import { checkTypes } from './utils'
import {
    isEphemeraRoomId,
    type EphemeraRoomId,
    isEphemeraCharacterId,
    type EphemeraCharacterId,
    isEphemeraObjectId,
    type EphemeraObjectId,
    isEphemeraFeatureId,
    type EphemeraFeatureId,
    isEphemeraAreaId,
    type EphemeraAreaId,
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
// play meta on Meta::Object, placement on ludicGraph + POSITION#ROOM adjacency.
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

    //
    // Object-hosted play membership graph (MK2). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
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
    if ('ludicGraph' in o && !isEphemeraLudicGraphFieldPayload(o.ludicGraph)) {
        return false
    }
    return true
}

/**
 * ephemeraDB play meta for FEATURE#. No pre-existing `Meta::Feature` record of any kind exists
 * yet (checked before MK3 --- only forward-looking "out of scope" mentions in dataSource/state
 * and renderOrchestration docs), so unlike `EphemeraMetaObject` this carries no non-ludicGraph
 * fields: MD-1(c)'s plain shape, same as Character.
 */
export type EphemeraMetaFeature = {
    EphemeraId: EphemeraFeatureId;
    DataCategory: 'Meta::Feature';

    //
    // Feature-hosted play membership graph (MK3). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character/Meta::Object; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

export const isEphemeraMetaFeature = (entry: unknown): entry is EphemeraMetaFeature => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const f = entry as Record<string, unknown>
    if (typeof f.EphemeraId !== 'string' || !isEphemeraFeatureId(f.EphemeraId) || f.DataCategory !== 'Meta::Feature') {
        return false
    }
    if ('ludicGraph' in f && !isEphemeraLudicGraphFieldPayload(f.ludicGraph)) {
        return false
    }
    return true
}

/**
 * ephemeraDB play meta for AREA#. No pre-existing `Meta::Area` record of any kind exists yet
 * (checked before MK4, same as MK3's Feature finding), so this carries no non-ludicGraph fields:
 * MD-1(c)'s plain shape, same as Character/Object/Feature.
 */
export type EphemeraMetaArea = {
    EphemeraId: EphemeraAreaId;
    DataCategory: 'Meta::Area';

    //
    // Area-hosted play membership graph (MK4). Same EphemeraLudicGraphFieldPayload shape as
    // Meta::Room/Meta::Character/Meta::Object/Meta::Feature; no fallback source when absent (MD-1(c)).
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
}

export const isEphemeraMetaArea = (entry: unknown): entry is EphemeraMetaArea => {
    if (typeof entry !== 'object' || entry === null) {
        return false
    }
    const a = entry as Record<string, unknown>
    if (typeof a.EphemeraId !== 'string' || !isEphemeraAreaId(a.EphemeraId) || a.DataCategory !== 'Meta::Area') {
        return false
    }
    if ('ludicGraph' in a && !isEphemeraLudicGraphFieldPayload(a.ludicGraph)) {
        return false
    }
    return true
}

//
// Ludic graph edge/port terminals (LP2). A terminal is either a bare component id (the
// EphemeraLudicTerminalPrimitive branch) or a structured port address on that component
// (EphemeraLudicPortAddress). The parsed shape IS the stored shape --- no string form, no
// separator parsing, in the domain layer (see AGENT.ludicGraphPorts.planning.md, PQ-9). The
// serde/Dynamo string boundary is deferred to a later slice, gated on a port address needing
// to stand free of an edge.
//

export type EphemeraLudicTerminalPrimitive =
    | EphemeraRoomId | EphemeraCharacterId
    | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId

export const isEphemeraLudicTerminalPrimitive = (value: unknown): value is EphemeraLudicTerminalPrimitive =>
    typeof value === 'string' && (
        isEphemeraRoomId(value) || isEphemeraCharacterId(value) ||
        isEphemeraObjectId(value) || isEphemeraFeatureId(value) || isEphemeraAreaId(value)
    )

/** owner is the whole that ALLOCATED this port (premise 12 / LD-10 naming). */
export type EphemeraLudicPortAddress = {
    owner: EphemeraLudicTerminalPrimitive;
    port: string;
}

export const isEphemeraLudicPortAddress = (value: unknown): value is EphemeraLudicPortAddress => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const address = value as EphemeraLudicPortAddress
    return isEphemeraLudicTerminalPrimitive(address.owner) && typeof address.port === 'string' && address.port.length > 0
}

export type EphemeraLudicTerminalId =
    | EphemeraLudicTerminalPrimitive
    | EphemeraLudicPortAddress

/** The base component a terminal names --- itself if unqualified, `.owner` if port-qualified. */
export const ephemeraLudicTerminalOwner = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalPrimitive =>
    typeof terminal === 'string' ? terminal : terminal.owner

/** Full terminal equality --- a primitive and a port address on the same owner are NOT equal. */
export const ephemeraLudicTerminalsEqual = (a: EphemeraLudicTerminalId, b: EphemeraLudicTerminalId): boolean => {
    if (typeof a === 'string' || typeof b === 'string') {
        return a === b
    }
    return a.owner === b.owner && a.port === b.port
}

/** True when a terminal (qualified or not) resolves to the given component id. */
export const ephemeraLudicTerminalRefersTo = (terminal: EphemeraLudicTerminalId, id: EphemeraLudicTerminalPrimitive): boolean =>
    ephemeraLudicTerminalOwner(terminal) === id

/** Slice 2 v1 shipped Character nodes; Phase 4 shipped Object nodes; CC0b shipped Room nodes (nodes only). */
export type EphemeraLudicGraphNode =
    | {
        tag: 'Character';
        universalKey: EphemeraCharacterId;
    }
    | {
        tag: 'Object';
        universalKey: EphemeraObjectId;
    }
    | {
        tag: 'Room';
        universalKey: EphemeraRoomId;
    }

export type HostRelationalEdgeKind = 'On' | 'Under' | 'Against' | 'Custom'

/**
 * In-host relational edge on room ludicGraph (Phase B establishRelation / dissolveRelation).
 * `from`/`to` are `EphemeraLudicTerminalPrimitive` (LP4) --- any legal host-kind component,
 * not only Objects --- matching what LP0 already made a legal host. Port-address terminals
 * (`EphemeraLudicPortAddress`) are Stage 2/LP7, deliberately not admitted here yet.
 */
export type EphemeraLudicRelationalEdgeData = {
    tag: 'Relational';
    from: EphemeraLudicTerminalPrimitive;
    to: EphemeraLudicTerminalPrimitive;
    kind: HostRelationalEdgeKind;
    relationLabel?: string;
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom'])

export const isEphemeraLudicRelationalEdgeData = (value: unknown): value is EphemeraLudicRelationalEdgeData => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const edge = value as EphemeraLudicRelationalEdgeData
    if (edge.tag !== 'Relational') {
        return false
    }
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !isEphemeraLudicTerminalPrimitive(edge.from) || !isEphemeraLudicTerminalPrimitive(edge.to)) {
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
export type EphemeraLudicGraphData = {
    hostId: EphemeraMembershipHostId;
    /** The graph's designated root node, present in `nodes` (concepts clause 3). Recorded, never derived (premise 10) --- LP4a. */
    rootId: EphemeraLudicTerminalId;
    nodes: EphemeraLudicGraphNode[];
    /** Phase B: in-host relational edges on room host graphs; absent or [] when none. */
    edges?: EphemeraLudicRelationalEdgeData[];
}

/** Value of Meta::*.ludicGraph attribute only (hostId omitted; row EphemeraId is authoritative). */
export type EphemeraLudicGraphFieldPayload = Omit<EphemeraLudicGraphData, 'hostId'>

export const isEphemeraLudicGraphNode = (value: unknown): value is EphemeraLudicGraphNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as EphemeraLudicGraphNode
    if ('key' in entry) {
        return false
    }
    if (entry.tag === 'Character') {
        return isEphemeraCharacterId(entry.universalKey)
    }
    if (entry.tag === 'Object') {
        return isEphemeraObjectId(entry.universalKey)
    }
    if (entry.tag === 'Room') {
        return isEphemeraRoomId(entry.universalKey)
    }
    return false
}

export const isEphemeraLudicGraphFieldPayload = (value: unknown): value is EphemeraLudicGraphFieldPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraLudicGraphFieldPayload
    if (!(typeof graph.rootId === 'string' ? isEphemeraLudicTerminalPrimitive(graph.rootId) : isEphemeraLudicPortAddress(graph.rootId))) {
        return false
    }
    if (!Array.isArray(graph.nodes)) {
        return false
    }
    if (!graph.nodes.every((entry) => isEphemeraLudicGraphNode(entry))) {
        return false
    }
    if ('edges' in graph) {
        const edges = graph.edges
        if (!Array.isArray(edges) || !edges.every((entry) => isEphemeraLudicRelationalEdgeData(entry))) {
            return false
        }
    }
    return true
}

export const isEphemeraLudicGraphData = (value: unknown): value is EphemeraLudicGraphData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraLudicGraphData
    if (typeof graph.hostId !== 'string' || !isEphemeraMembershipHostId(graph.hostId)) {
        return false
    }
    return isEphemeraLudicGraphFieldPayload(graph)
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
    ludicGraph?: EphemeraLudicGraphFieldPayload;

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
    if ('ludicGraph' in value && !isEphemeraLudicGraphFieldPayload(value.ludicGraph)) {
        return false
    }
    return true
}

//
// Partial projection of the ephemeraDB `Meta::Character` row (same PK/SK as presentation meta).
//
// The full row also carries `RoomStack`, `Name`, `HomeId`, `assets`, and other fields typed for
// lambda `CharacterMeta` / eviction-ladder reads --- not duplicated here. This interface names
// only the positions-owned slice we validate on Dynamo fetch (e.g. `getCharacterLudicGraphFromDynamo`
// projects `ludicGraph` via `Pick<EphemeraMetaCharacter, 'ludicGraph'>`). Do not treat the
// type name as a complete meta document shape.
//
export type EphemeraMetaCharacter = {
    EphemeraId: EphemeraCharacterId;
    DataCategory: 'Meta::Character';

    //
    // Play-time inventory graph (D16 / character host). v1: Object membership nodes only.
    //
    ludicGraph?: EphemeraLudicGraphFieldPayload;
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
    if ('ludicGraph' in value) {
        const ludicGraph = value.ludicGraph
        if (!isEphemeraLudicGraphFieldPayload(ludicGraph)) {
            return false
        }
        const hasCharacterNode = ludicGraph.nodes.some((node) => node.tag === 'Character')
        if (hasCharacterNode) {
            return false
        }
    }
    return true
}

