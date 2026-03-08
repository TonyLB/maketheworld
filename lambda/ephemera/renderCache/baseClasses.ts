import {
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraRoomId,
    EphemeraSituationId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

//
// Ephemera render cache record types and constants
//
// Design sources:
// - lambda/ephemera/AGENT.caching.planning.md
// - lambda/ephemera/AGENT.caching.firstMVP.planning.md
//

export type EphemeraCacheComponentId =
    | EphemeraRoomId
    | EphemeraFeatureId
    | EphemeraKnowledgeId

//
// markState: Mark UUID to Match string pairs
//

export type EphemeraCacheMarkValue = {
    //
    // Mark UUID from the Assets/WML schema
    //
    mark: string;
    //
    // Match string associated with the Mark in this state
    //
    value: string;
}

export type EphemeraCacheMarkState = {
    //
    // Canonical container for Mark values; callers should
    // normalize ordering when comparing for exact match.
    //
    markValue: EphemeraCacheMarkValue[];
}

//
// renderedContent: Cached description parallel to StandardExample
//

export type EphemeraCacheRenderedContent = {
    displayName?: RenderTree;
    summary?: RenderTree;
    description: RenderTree;
}

//
// provenance: Source of the cached example
//

export type EphemeraCacheProvenance = {
    type: 'authored' | 'generated';
}

export const EPHEMERA_CACHE_PROVENANCE_AUTHORED = 'authored' as const
export const EPHEMERA_CACHE_PROVENANCE_GENERATED = 'generated' as const

//
// perspectiveId: Known inactive (not used for matching). Kept on the record
// pending possible later use for search optimization.
//

export type EphemeraPerspectiveId = string

//
// situationId: Optional link to the Situation UUID for Room cache records.
// Used to target delete on ExampleRemoved when exampleId is SITUATION#.
//

//
// authoredExampleId: Optional link back to the blueprint Example UUID
// that generated this cache record (Feature/Knowledge). Used to target
// delete on ExampleRemoved events when exampleId is EXAMPLE#.
//

export type EphemeraAuthoredExampleId = string

//
// Domain-level cache record used within Ephemera code
//

export type EphemeraCacheRecord = {
    componentId: EphemeraCacheComponentId;
    markState: EphemeraCacheMarkState;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
    authoredExampleId?: EphemeraAuthoredExampleId;
}

//
// Raw DynamoDB item shape for render cache records
//

export const EPHEMERA_CACHE_DATA_CATEGORY_PREFIX = 'CACHE#' as const

export type EphemeraCacheDynamoItem = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: string;
    markState: EphemeraCacheMarkState;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
    authoredExampleId?: EphemeraAuthoredExampleId;
}

export const isEphemeraCacheDynamoItem = (item: any): item is EphemeraCacheDynamoItem => {
    if (!item || typeof item !== 'object') {
        return false
    }
    const { EphemeraId, DataCategory, markState, renderedContent, provenance, perspectiveId, perspectiveMatcher } = item
    if (typeof EphemeraId !== 'string' || typeof DataCategory !== 'string') {
        return false
    }
    if (!DataCategory.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
        return false
    }
    if (typeof perspectiveId !== 'string') {
        return false
    }
    if (!perspectiveMatcher || typeof perspectiveMatcher !== 'object' || !Array.isArray(perspectiveMatcher.requiredAssetIds)) {
        return false
    }
    if (!markState || typeof markState !== 'object' || !Array.isArray(markState.markValue)) {
        return false
    }
    if (!markState.markValue.every(
        (entry: any) => entry && typeof entry === 'object'
            && typeof entry.mark === 'string'
            && typeof entry.value === 'string'
    )) {
        return false
    }
    if (!renderedContent || typeof renderedContent !== 'object') {
        return false
    }
    if (!('description' in renderedContent) || typeof renderedContent.description !== 'object') {
        return false
    }
    if (!provenance || typeof provenance !== 'object' || typeof provenance.type !== 'string') {
        return false
    }
    if (
        provenance.type !== EPHEMERA_CACHE_PROVENANCE_AUTHORED
        && provenance.type !== EPHEMERA_CACHE_PROVENANCE_GENERATED
    ) {
        return false
    }
    return true
}

