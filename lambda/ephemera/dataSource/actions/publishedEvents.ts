import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { areCoyoteObjectTropeFieldsValid } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/**
 * Outbound stream payloads for mtw.ephemera.actions (bus-only DataSource).
 */
export const EPHEMERA_ACTIONS_DATA_SOURCE_KEY = 'mtw.ephemera.actions' as const

export type ActionsStubPublishedPayload = {
    type: 'ActionsStub';
}

export type CharacterNavigatePublishedPayload = {
    type: 'Character Navigate';
    characterId: EphemeraCharacterId;
    fromRoomId: EphemeraRoomId;
    toRoomId: EphemeraRoomId;
    /** Normalized exit label when parse matched a named exit (fan-in exit-aware copy). */
    exitName?: string;
}

export type CharacterHomePublishedPayload = {
    type: 'Character Home';
    characterId: EphemeraCharacterId;
    fromRoomId: EphemeraRoomId;
    toRoomId: EphemeraRoomId;
}

/** `objectIds` is the carry-closed transfer set (BD-13); size 1 for an ordinary take-hold. */
export type ObjectTakeHoldPublishedPayload = {
    type: 'Object Take Hold';
    characterId: EphemeraCharacterId;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    confidence?: number;
}

/** `objectIds` is the carry-closed transfer set (BD-13); size 1 for an ordinary drop. */
export type ObjectDropPublishedPayload = {
    type: 'Object Drop';
    characterId: EphemeraCharacterId;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    confidence?: number;
}

export type HostRelationalEdgeKindPublished = 'On' | 'Under' | 'Against' | 'Custom'

const HOST_RELATIONAL_EDGE_KINDS_PUBLISHED = new Set<HostRelationalEdgeKindPublished>([
    'On',
    'Under',
    'Against',
    'Custom',
])

export type ObjectEstablishRelationPublishedPayload = {
    type: 'Object Establish Relation';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    /** Room or Character host the relation is established on (BD-15/16 slice 4; was Room-only `roomId`). */
    hostId: EphemeraMembershipHostId;
    relationKind: HostRelationalEdgeKindPublished;
    relationLabel?: string;
    confidence?: number;
    /** BD-16 sameHost repair (2026-07-21): present when the subject must move to `hostId` atomically with the relation. */
    transferFromHostId?: EphemeraMembershipHostId;
}

export type ObjectDissolveRelationPublishedPayload = {
    type: 'Object Dissolve Relation';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    /** Room or Character host the relation is dissolved on (BD-15/16 slice 4; was Room-only `roomId`). */
    hostId: EphemeraMembershipHostId;
    relationKind: HostRelationalEdgeKindPublished;
    relationLabel?: string;
    confidence?: number;
    /** BD-16 sameHost repair (2026-07-21): present when the subject must move to `hostId` atomically with the relation. */
    transferFromHostId?: EphemeraMembershipHostId;
}

const isHostRelationalIngressFieldsValid = (v: Record<string, unknown>): boolean => {
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (typeof v.subjectId !== 'string' || !isEphemeraObjectId(v.subjectId)) {
        return false
    }
    if (typeof v.targetId !== 'string' || !isEphemeraObjectId(v.targetId)) {
        return false
    }
    if (typeof v.hostId !== 'string' || !isEphemeraMembershipHostId(v.hostId)) {
        return false
    }
    if (typeof v.relationKind !== 'string' || !HOST_RELATIONAL_EDGE_KINDS_PUBLISHED.has(v.relationKind as HostRelationalEdgeKindPublished)) {
        return false
    }
    if (v.relationKind === 'Custom') {
        if (!(typeof v.relationLabel === 'string' && v.relationLabel.length > 0)) {
            return false
        }
    } else if (v.relationLabel !== undefined && typeof v.relationLabel !== 'string') {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    if (v.transferFromHostId !== undefined) {
        if (typeof v.transferFromHostId !== 'string' || !isEphemeraMembershipHostId(v.transferFromHostId)) {
            return false
        }
    }
    return true
}

export const isObjectEstablishRelationPublishedPayload = (
    value: unknown
): value is ObjectEstablishRelationPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Establish Relation') {
        return false
    }
    return isHostRelationalIngressFieldsValid(v)
}

export const isObjectDissolveRelationPublishedPayload = (
    value: unknown
): value is ObjectDissolveRelationPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Dissolve Relation') {
        return false
    }
    return isHostRelationalIngressFieldsValid(v)
}

export type AwaitRoadRunnerPublishedPayload = {
    type: 'Await RoadRunner';
    characterId: EphemeraCharacterId;
    confidence: number;
}

export type PredictHypothesisPublishedPayload = {
    type: 'Predict Hypothesis';
    characterId: EphemeraCharacterId;
    confidence: number;
}

/** Event-driven look: render orchestration registers perception thread and runs passive render. */
export type LookCommandRequestedPublishedPayload = {
    type: 'Look Command Requested';
    characterId: EphemeraCharacterId;
    /** Room, Feature, Knowledge, or Object (stub, shortName only --- see PK-6) host for this look. */
    componentId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraObjectId;
    confidence: number;
    /** When true on Knowledge looks, fan-in targets SESSION#... */
    directResponse?: boolean;
}

/** One catalog line on the bus; aligns with Objects Change add row (EphemeraMetaRoomObject) minus uuid. */
export type AcmeOrderPublishedOrder = {
    shortName: string;
    /** Machine correlation key after deterministic finalize in actions `index.ts`. */
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}

export type AcmeOrderPublishedPayload = {
    type: 'Acme Order';
    characterId: EphemeraCharacterId;
    orders: AcmeOrderPublishedOrder[];
    confidence: number;
}

export type CharacterSpeechDisplayProtocol = 'SayMessage' | 'NarrateMessage' | 'OOCMessage'

const CHARACTER_SPEECH_DISPLAY_PROTOCOLS: ReadonlySet<CharacterSpeechDisplayProtocol> = new Set([
    'SayMessage',
    'NarrateMessage',
    'OOCMessage',
])

/** Terminal character-voice depiction; consumed by mtw.ephemera.narration. */
export type CharacterSpokePublishedPayload = {
    type: 'Character Spoke';
    characterId: EphemeraCharacterId;
    message: string;
    displayProtocol: CharacterSpeechDisplayProtocol;
    /** Parse confidence when emitted from typed commands; omit for trusted UI. */
    confidence?: number;
}

export const isCharacterSpokePublishedPayload = (
    value: unknown
): value is CharacterSpokePublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Character Spoke') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (typeof v.message !== 'string' || v.message.trim().length === 0) {
        return false
    }
    if (
        typeof v.displayProtocol !== 'string'
        || !CHARACTER_SPEECH_DISPLAY_PROTOCOLS.has(v.displayProtocol as CharacterSpeechDisplayProtocol)
    ) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    return true
}

export const isAwaitRoadRunnerPublishedPayload = (
    value: unknown
): value is AwaitRoadRunnerPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Await RoadRunner') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
        return false
    }
    return true
}

export const isPredictHypothesisPublishedPayload = (
    value: unknown
): value is PredictHypothesisPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Predict Hypothesis') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
        return false
    }
    return true
}

export const isCharacterNavigatePublishedPayload = (
    value: unknown
): value is CharacterNavigatePublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Character Navigate') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.fromRoomId !== 'string') {
        return false
    }
    if (typeof v.toRoomId !== 'string') {
        return false
    }
    if (v.exitName !== undefined) {
        if (typeof v.exitName !== 'string' || v.exitName.trim().length === 0) {
            return false
        }
    }
    return true
}

export const isObjectTakeHoldPublishedPayload = (
    value: unknown
): value is ObjectTakeHoldPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Take Hold') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!Array.isArray(v.objectIds) || v.objectIds.length === 0 || !v.objectIds.every((id) => typeof id === 'string' && isEphemeraObjectId(id))) {
        return false
    }
    if (typeof v.roomId !== 'string' || !isEphemeraRoomId(v.roomId)) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    return true
}

export const isObjectDropPublishedPayload = (
    value: unknown
): value is ObjectDropPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Drop') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!Array.isArray(v.objectIds) || v.objectIds.length === 0 || !v.objectIds.every((id) => typeof id === 'string' && isEphemeraObjectId(id))) {
        return false
    }
    if (typeof v.roomId !== 'string' || !isEphemeraRoomId(v.roomId)) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    return true
}

export const isCharacterHomePublishedPayload = (
    value: unknown
): value is CharacterHomePublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Character Home') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.fromRoomId !== 'string') {
        return false
    }
    if (typeof v.toRoomId !== 'string') {
        return false
    }
    return true
}

export const isLookCommandRequestedPublishedPayload = (
    value: unknown
): value is LookCommandRequestedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Look Command Requested') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (typeof v.componentId !== 'string') {
        return false
    }
    if (
        !isEphemeraRoomId(v.componentId)
        && !isEphemeraFeatureId(v.componentId)
        && !isEphemeraKnowledgeId(v.componentId)
        && !isEphemeraObjectId(v.componentId)
    ) {
        return false
    }
    if (v.directResponse !== undefined && typeof v.directResponse !== 'boolean') {
        return false
    }
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
        return false
    }
    return true
}

export const isAcmeOrderPublishedOrder = (value: unknown): value is AcmeOrderPublishedOrder => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const o = value as Record<string, unknown>
    if (typeof o.shortName !== 'string' || o.shortName.trim().length === 0) {
        return false
    }
    if (!areCoyoteObjectTropeFieldsValid(o)) {
        return false
    }
    if (typeof o.stableKey !== 'string' || o.stableKey.trim().length === 0) {
        return false
    }
    return true
}

export const isAcmeOrderPublishedPayload = (
    value: unknown
): value is AcmeOrderPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Acme Order') {
        return false
    }
    if (typeof v.characterId !== 'string') {
        return false
    }
    if (!Array.isArray(v.orders) || !v.orders.every((entry) => isAcmeOrderPublishedOrder(entry))) {
        return false
    }
    if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
        return false
    }
    return true
}

export type ActionsPublishedPayload =
    | ActionsStubPublishedPayload
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ObjectTakeHoldPublishedPayload
    | ObjectDropPublishedPayload
    | ObjectEstablishRelationPublishedPayload
    | ObjectDissolveRelationPublishedPayload
    | CharacterSpokePublishedPayload
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload
    | PredictHypothesisPublishedPayload
    | LookCommandRequestedPublishedPayload
