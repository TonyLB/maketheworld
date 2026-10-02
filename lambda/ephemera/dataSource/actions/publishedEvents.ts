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
import type { AcmeOrderEnrichDefaultSituationProse, CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { areCoyoteObjectTropeFieldsValid, isAcmeOrderEnrichDefaultSituationProse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { CommandAttemptData } from './commandAttempt'
import { isCommandAttemptData } from './commandAttempt/adjudicate'

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
    /** messageOrchestration bundle correlation id, minted once here; shared by the positions execution tail and the perception membership fan-in intent leg. Optional so pre-migration/synthetic payloads degrade gracefully to direct-publish rather than dropping the leg. */
    bundleId?: string;
}

export type CharacterHomePublishedPayload = {
    type: 'Character Home';
    characterId: EphemeraCharacterId;
    fromRoomId: EphemeraRoomId;
    toRoomId: EphemeraRoomId;
    /** messageOrchestration bundle correlation id, minted once here; shared by the positions execution tail and the perception membership fan-in intent leg. Optional so pre-migration/synthetic payloads degrade gracefully to direct-publish rather than dropping the leg. */
    bundleId?: string;
}

/** AB-54 hosting kinds; only `'On'` is ever emitted today (only one hosting kind is built). */
export type ContainmentKindPublished = 'On' | 'In' | 'PartOf'

const CONTAINMENT_KINDS_PUBLISHED = new Set<ContainmentKindPublished>(['On', 'In', 'PartOf'])

/**
 * `On` is a containment move carrying a containment argument, not a relation --- deliberately
 * separate from the relational hand-off (`Ludic Network Change Requested`'s relational
 * actions), which narrowed `On` out on 2026-08-22. `roomId` is narration context (the
 * acting character's room), not `subjectId`'s current host --- the `mtw.ephemera.positions`
 * consumer resolves that fresh via `getMembershipContainers` rather than trusting a value
 * published at parse time.
 */
export type ObjectContainmentPublishedPayload = {
    type: 'Object Containment';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    containment: ContainmentKindPublished;
    confidence?: number;
    /** The player's attempt, with any verdicts Adjudicate recorded actions-side. `positions/index.ts` reconstructs it, and the commit side honors its verdicts. */
    attempt?: CommandAttemptData;
}

/**
 * AP-9: the generalized hand-off, replacing the per-primitive events above. Carries the
 * whole selected attempt --- no primitive named in the header, since a plan can mix kinds
 * (slice 3c's containment is the first to). Published alongside the per-primitive events
 * during slice 3a (3a-i to 3a-iii) so `positions` can be migrated without a flag day; the
 * per-primitive events for membership and relational retire in 3a-iv. `Object Containment`
 * keeps publishing on its own until containment joins in slice 3c.
 */
export type LudicNetworkChangeRequestedPublishedPayload = {
    type: 'Ludic Network Change Requested';
    characterId: EphemeraCharacterId;
    attempt: CommandAttemptData;
    confidence?: number;
}

export const isLudicNetworkChangeRequestedPublishedPayload = (
    value: unknown
): value is LudicNetworkChangeRequestedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Ludic Network Change Requested') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!isCommandAttemptData(v.attempt)) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    return true
}

export const isObjectContainmentPublishedPayload = (
    value: unknown
): value is ObjectContainmentPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Containment') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (typeof v.subjectId !== 'string' || !isEphemeraObjectId(v.subjectId)) {
        return false
    }
    if (typeof v.targetId !== 'string' || !isEphemeraObjectId(v.targetId)) {
        return false
    }
    if (typeof v.roomId !== 'string' || !isEphemeraRoomId(v.roomId)) {
        return false
    }
    if (typeof v.containment !== 'string' || !CONTAINMENT_KINDS_PUBLISHED.has(v.containment as ContainmentKindPublished)) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    if (v.attempt !== undefined && !isCommandAttemptData(v.attempt)) {
        return false
    }
    return true
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
    /** Room, Feature, Knowledge, Object, or Character host for this look. All five deliver real
     * rendered content; Object's PK-6 shortName-only stub was retired in `cf5472cef` --- see
     * `positions/manipulation/kernel/presentStepSequence.ts` for what replaced it. */
    componentId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraObjectId | EphemeraCharacterId;
    confidence: number;
}

/** One catalog line on the bus; aligns with Objects Change add row (EphemeraMetaRoomObject) minus uuid. */
export type AcmeOrderPublishedOrder = {
    shortName: string;
    /** Machine correlation key after deterministic finalize in actions `index.ts`. */
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
    /** `SITUATION#DEFAULT` flavor-text prose from Acme enrich; consumed at object spawn. */
    defaultSituation?: AcmeOrderEnrichDefaultSituationProse;
    defaultSituationFailed?: boolean;
    /** Short, reasoning-facing identity description from Acme enrich (see `actions/AGENT.concepts.md`'s `CommandAttempt` section); absence is valid. */
    gloss?: string;
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
    if (v.bundleId !== undefined && typeof v.bundleId !== 'string') {
        return false
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
    if (v.bundleId !== undefined && typeof v.bundleId !== 'string') {
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
        && !isEphemeraCharacterId(v.componentId)
    ) {
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
    if ('defaultSituation' in o && o.defaultSituation !== undefined && !isAcmeOrderEnrichDefaultSituationProse(o.defaultSituation)) {
        return false
    }
    if ('defaultSituationFailed' in o && typeof o.defaultSituationFailed !== 'boolean') {
        return false
    }
    if ('gloss' in o && o.gloss !== undefined && typeof o.gloss !== 'string') {
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
    | ObjectContainmentPublishedPayload
    | LudicNetworkChangeRequestedPublishedPayload
    | CharacterSpokePublishedPayload
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload
    | PredictHypothesisPublishedPayload
    | LookCommandRequestedPublishedPayload
