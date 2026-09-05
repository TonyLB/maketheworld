import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
import { isEphemeraLudicGraphPort, isEphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AcmeOrderEnrichDefaultSituationProse, CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { areCoyoteObjectTropeFieldsValid, isAcmeOrderEnrichDefaultSituationProse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { MutationKernelStep } from '../positions/manipulation/kernel/kernelStep'

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


/** Deliberately narrow --- ingress lane (LD-13/BD-2): `In`/`PartOf` must not parse into `establishRelation`. **`On` joined them 2026-08-22** (Channel D, CD2, reduced scope): AB-54 makes `On` a hosting kind too, and it no longer parses here either -- narrowed out of this type, not just out of the phrase maps, since nothing can construct this type with `'On'` any more. */
export type HostRelationalEdgeKindPublished = 'Under' | 'Against' | 'Custom'

const HOST_RELATIONAL_EDGE_KINDS_PUBLISHED = new Set<HostRelationalEdgeKindPublished>([
    'Under',
    'Against',
    'Custom',
])

export type ObjectEstablishRelationPublishedPayload = {
    type: 'Object Establish Relation';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    /**
     * Room or Character host the relation is established on (BD-15/16 slice 4; was Room-only
     * `roomId`) --- narration/perception use only: `objectManipulationPresentationLegAdapters.ts`
     * gates narration on this being a Room. The commit mechanism no longer trusts it as "the"
     * host --- see `steps`, where a genuine crossing carries more than one.
     */
    hostId: EphemeraMembershipHostId;
    confidence?: number;
    /**
     * the Expansion-derived mutation-kernel step chain (`ParseCommandEstablishRelationResult.steps`, carried across the publish/subscribe
     * boundary unchanged) --- what `executeEstablishEdgeChain` actually commits. A portless/
     * same-host candidate carries exactly one `establishRelation` entry; a genuine crossing
     * carries one `addCrossingPort` plus a hop leg per side, in production order (port steps
     * precede the legs that reference them). Each step carries its own `hostId` ---
     * there is no single host for a crossing as a whole, which is why the flat `hostId` above
     * stays narration-only rather than being derived from this array at read time.
     */
    steps: readonly MutationKernelStep[];
} & RelationalKindAndLabel<HostRelationalEdgeKindPublished>

export type ObjectDissolveRelationPublishedPayload = {
    type: 'Object Dissolve Relation';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    /**
     * Room or Character host the relation is dissolved on (BD-15/16 slice 4; was Room-only
     * `roomId`) --- narration/perception use only:
     * `objectManipulationPresentationLegAdapters.ts` gates narration on this being a Room.
     * See `steps`, where a genuine crossing dissolve carries more than one host.
     */
    hostId: EphemeraMembershipHostId;
    confidence?: number;
    /**
     * Mirroring the establish side: the Expansion-derived mutation-kernel step chain
     * (`ParseCommandEstablishRelationResult.steps`, carried across the publish/subscribe
     * boundary unchanged) for a dissolve candidate. A portless/same-host candidate carries
     * exactly one `dissolveRelation` entry; a genuine crossing dissolve carries a
     * `dissolveRelation`/`removeCrossingPort` pair per hop. Not yet consumed by the positions
     * handler --- carried here so it is available once that row wires it in.
     */
    steps: readonly MutationKernelStep[];
} & RelationalKindAndLabel<HostRelationalEdgeKindPublished>

/** Shared by the payload-level and step-level relational kind/label checks below --- both spell the same `RelationalKindAndLabel<HostRelationalEdgeKindPublished>` fragment. */
const isValidPublishedRelationKindAndLabel = (v: Record<string, unknown>): boolean => {
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
    return true
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
    if (!isValidPublishedRelationKindAndLabel(v)) {
        return false
    }
    if (v.confidence !== undefined) {
        if (typeof v.confidence !== 'number' || !Number.isFinite(v.confidence)) {
            return false
        }
    }
    return true
}

/**
 * the only `MutationKernelStep` kinds `buildCrossingLegs.ts`/`compileRelationalFromSkeleton.ts`
 * can ever put in `ParseCommandEstablishRelationResult.steps` on this route --- `transferMembership`,
 * `capture`, and `addPresencePort`/`removePresencePort` never appear here, so this guard does not
 * attempt to validate them.
 */
const PUBLISHED_MUTATION_KERNEL_STEP_KINDS = new Set([
    'establishRelation',
    'dissolveRelation',
    'addCrossingPort',
    'removeCrossingPort',
])

const isPublishedMutationKernelStep = (value: unknown): value is MutationKernelStep => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.kind !== 'string' || !PUBLISHED_MUTATION_KERNEL_STEP_KINDS.has(v.kind)) {
        return false
    }
    if (typeof v.hostId !== 'string' || !isEphemeraMembershipHostId(v.hostId)) {
        return false
    }
    if (v.kind === 'establishRelation' || v.kind === 'dissolveRelation') {
        return isEphemeraLudicTerminalId(v.subjectId) && isEphemeraLudicTerminalId(v.targetId) && isValidPublishedRelationKindAndLabel(v)
    }
    if (v.kind === 'addCrossingPort') {
        return isEphemeraLudicGraphPort(v.port)
    }
    // removeCrossingPort
    return typeof v.portId === 'string' && v.portId.length > 0
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
    if (!isHostRelationalIngressFieldsValid(v)) {
        return false
    }
    return Array.isArray(v.steps) && v.steps.length > 0 && v.steps.every(isPublishedMutationKernelStep)
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
    if (!isHostRelationalIngressFieldsValid(v)) {
        return false
    }
    return Array.isArray(v.steps) && v.steps.length > 0 && v.steps.every(isPublishedMutationKernelStep)
}

/** AB-54 hosting kinds; only `'On'` is ever emitted today (only one hosting kind is built). */
export type ContainmentKindPublished = 'On' | 'In' | 'PartOf'

const CONTAINMENT_KINDS_PUBLISHED = new Set<ContainmentKindPublished>(['On', 'In', 'PartOf'])

/**
 * `On` is a rehost carrying a containment argument, not a relation --- deliberately
 * separate from `ObjectEstablishRelationPublishedPayload`, which narrowed `On` out on
 * 2026-08-22. `roomId` is narration context (the acting character's room), not `subjectId`'s
 * current host --- the `mtw.ephemera.positions` consumer resolves that fresh via
 * `getMembershipContainers` rather than trusting a value published at parse time.
 */
export type ObjectRehostPublishedPayload = {
    type: 'Object Rehost';
    characterId: EphemeraCharacterId;
    subjectId: EphemeraObjectId;
    targetId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    containment: ContainmentKindPublished;
    confidence?: number;
}

export const isObjectRehostPublishedPayload = (
    value: unknown
): value is ObjectRehostPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Rehost') {
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
    /** Room, Feature, Knowledge, Object (stub, shortName only --- see PK-6), or Character host for this look. */
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
    | ObjectRehostPublishedPayload
    | CharacterSpokePublishedPayload
    | AcmeOrderPublishedPayload
    | AwaitRoadRunnerPublishedPayload
    | PredictHypothesisPublishedPayload
    | LookCommandRequestedPublishedPayload
