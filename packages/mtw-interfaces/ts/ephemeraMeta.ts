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

/** Slice 2 v1: Character membership nodes only; edges empty until slice 5+. Play identity is universalKey only (no asset-local key). */
export type EphemeraPlayPositionGraphNode = {
    tag: 'Character';
    universalKey: EphemeraCharacterId;
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
    if (entry.tag !== 'Character') {
        return false
    }
    if (!isEphemeraCharacterId(entry.universalKey)) {
        return false
    }
    if ('key' in entry) {
        return false
    }
    return true
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
    // Play-time membership graph (slice 2+ authority). Slice 2 v1: character nodes only.
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

