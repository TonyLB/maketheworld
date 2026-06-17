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
export type EphemeraRoomCurrentCacheByPerspective = Record<EphemeraPerspectiveKey, EphemeraCacheId>

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

/** Runtime object row on Meta::Room; uuid is OBJECT#... (ephemera wire / WML StandardRoom.objects). */
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
// First-class improvisational objects (Phase 0 sketch; persistence Phase 2+)
//
// ADR (I1 / I2): three-way split mirrors Character --- merge body on component pair row,
// play meta on Meta::Object, placement on positionGraph + POSITION#ROOM adjacency.
//
// - One component pair row (OBJECT#, ASSET#...) + one (OBJECT#, Meta::Object) per spawned object.
//   v1 writes use ASSET#IMPROVISATION as DataCategory; type does not hard-code that layer.
// - shortName lives only on the pair row (future StandardObject JSON); never on Meta::Object.
// - stableKey / trope fields live only on EphemeraMetaObject.
// - Spawn/clear coordinators write or delete both rows in one transact (Phase 2/4).
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

/** Slice 2 v1 shipped Character nodes; Object nodes typed for Phase 4 (not yet written). */
export type EphemeraPlayPositionGraphNode =
    | {
        tag: 'Character';
        universalKey: EphemeraCharacterId;
    }
    | {
        tag: 'Object';
        universalKey: EphemeraObjectId;
    }

/** Play-time membership graph stored on Meta::Room (topology only; roster display hydrated at read time -- S2-6-H). */
export type EphemeraPlayPositionGraph = {
    nodes: EphemeraPlayPositionGraphNode[];
    /** Slice 2 v1: must be absent or []. In-room edges deferred. */
    edges?: [];
}

export const isEphemeraPlayPositionGraphNode = (value: unknown): value is EphemeraPlayPositionGraphNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as EphemeraPlayPositionGraphNode
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

export const isEphemeraPlayPositionGraph = (value: unknown): value is EphemeraPlayPositionGraph => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const graph = value as EphemeraPlayPositionGraph
    if (!Array.isArray(graph.nodes)) {
        return false
    }
    if (!graph.nodes.every((entry) => isEphemeraPlayPositionGraphNode(entry))) {
        return false
    }
    if ('edges' in graph) {
        const edges = graph.edges
        if (!Array.isArray(edges) || edges.length > 0) {
            return false
        }
    }
    return true
}

export type EphemeraMetaRoom = {
    EphemeraId: EphemeraRoomId;
    DataCategory: 'Meta::Room';

    //
    // Existing field used for presence lists and room updates.
    //
    activeCharacters?: EphemeraRoomActiveCharacter[];

    //
    // Play-time membership graph (slice 2+ authority). Character nodes shipped; Object nodes Phase 4+.
    //
    positionGraph?: EphemeraPlayPositionGraph;

    //
    // v1 world-state fields for state-driven, cache-backed Room rendering.
    //
    state?: EphemeraRoomState;
    /** Legacy fast-pointer map; canonical pointer is `currentCacheId` on `Cache::${perspectiveKey}` catalog rows (M2 migration). */
    currentCacheByPerspective?: EphemeraRoomCurrentCacheByPerspective;
    currentCacheId?: EphemeraCacheId;

    //
    // v1 runtime objects (mtw.ephemera.objects on this Meta::Room row).
    //
    objects?: EphemeraMetaRoomObject[];
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
    if ('currentCacheId' in value && typeof value.currentCacheId !== 'string') {
        return false
    }
    if (
        'currentCacheId' in value
        && typeof value.currentCacheId === 'string'
        && value.currentCacheId.length
        && !value.currentCacheId.startsWith('CACHE#')
    ) {
        return false
    }
    if ('currentCacheByPerspective' in value) {
        const currentCacheByPerspective = value.currentCacheByPerspective
        if (!currentCacheByPerspective || typeof currentCacheByPerspective !== 'object' || Array.isArray(currentCacheByPerspective)) {
            return false
        }
        const ok = Object.entries(currentCacheByPerspective as Record<string, unknown>).every(([perspectiveKey, cacheId]) => (
            typeof perspectiveKey === 'string'
            && perspectiveKey.length > 0
            && typeof cacheId === 'string'
            && cacheId.startsWith('CACHE#')
        ))
        if (!ok) {
            return false
        }
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
        const objects = value.objects
        if (!Array.isArray(objects)) {
            return false
        }
        if (!objects.every((entry: unknown) => isEphemeraMetaRoomObject(entry))) {
            return false
        }
    }
    if ('positionGraph' in value && !isEphemeraPlayPositionGraph(value.positionGraph)) {
        return false
    }
    return true
}

