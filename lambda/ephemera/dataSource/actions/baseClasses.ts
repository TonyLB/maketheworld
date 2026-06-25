import {
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    AcmeCatalogRejectionReason,
    AcmeOrderEnrichModelLine,
    CoyoteTrope,
    CoyoteTropeAptness,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { CoyoteEngineTestHarnessInvocation } from '../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { invokeBedrockObjectManipulationEnrich } from '../../generateExample/invokeBedrockObjectManipulationEnrich'
import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { CharacterSpeechDisplayProtocol } from './publishedEvents'
import type { RoomInPlayObjectCatalogEntry } from './roomObjectCatalogForCharacter'
import type { ObjectManipulationPositionsReadDeps } from './enrich/objectManipulation/membershipObservation'
import type { MessageBus } from '../../messageBus/baseClasses'

const CHARACTER_SPEECH_DISPLAY_PROTOCOLS: ReadonlySet<CharacterSpeechDisplayProtocol> = new Set([
    'SayMessage',
    'NarrateMessage',
    'OOCMessage',
])

/**
 * Injectable accessors for iterating Coyote demo rooms and graph-placed objects (shared by
 * **`collectCoyoteOccupiedStableKeys`**, **`countCoyotePlacedObjectsAcrossRooms`**, and **`ParseCommandDeps`**).
 */
export type CollectCoyoteOccupiedStableKeysDeps = {
    getGameRooms: () => Promise<string[]>
    getObjectIdsInRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraObjectId[]>
    getObjectMeta?: (objectId: EphemeraObjectId) => Promise<EphemeraMetaObject | undefined>
}

/**
 * Parser confidence for non-error outcomes. Typically in [0, 1]; validated by type guards.
 */
export type ParseCommandConfidence = number

const isParseConfidence = (value: unknown): value is ParseCommandConfidence => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

const isParseCommandAcmeOrderErrorType = (value: unknown): value is ParseCommandAcmeOrderErrorType => (
    value === 'Not a thing'
    || value === 'Not tangible'
    || value === 'Too large'
    || value === 'Celebrity cameo'
)

/**
 * Parser result for action ingress. Extend with non-error variants as the contract grows.
 * Intent is encoded by `type` (discriminated union). Slots/entities are per-variant fields.
 * `confidence` is required on every non-error variant. Parse diagnostics: not modeled yet.
 */
export type ParseCommandErrorResult = {
    type: 'Error'
    errorMessage?: string
}

export type ParseCommandNavigationResult = {
    type: 'Navigation'
    targetId: EphemeraRoomId
    /** Normalized exit label when navigation matched a named exit. */
    exitName?: string
    confidence: ParseCommandConfidence
}

/** Return to the character's configured home room (`Meta::Character.HomeId`). */
export type ParseCommandHomeResult = {
    type: 'Home'
    confidence: ParseCommandConfidence
}

/** Alias of **`AcmeCatalogRejectionReason`** for parse / courier apology copy. */
export type ParseCommandAcmeOrderErrorType = AcmeCatalogRejectionReason

/** Parsed Acme line: aligns with **`AcmeOrderEnrichModelLine`** (no **`stableKey`** on **`valid: false`**). */
export type ParseCommandAcmeOrderLine = AcmeOrderEnrichModelLine

/** Coyote Game: order from Acme (mail-order, catalog, or unspecified). One or more product lines. */
export type ParseCommandAcmeOrderResult = {
    type: 'AcmeOrder'
    /** One entry per distinct product or line item (single-item orders use length 1). */
    orders: ParseCommandAcmeOrderLine[]
    confidence: ParseCommandConfidence
}

/** Coyote Game: wait-state for Road Runner encounter flows. */
export type ParseCommandAwaitRoadrunnerResult = {
    type: 'AwaitRoadRunner'
    confidence: ParseCommandConfidence
}

/** Coyote Game: player-requested hypothesis generation from staged setup. */
export type ParseCommandPredictHypothesisResult = {
    type: 'PredictHypothesis'
    confidence: ParseCommandConfidence
}

/** Show coyote-game help affordance content; no Acme enrich. */
export type ParseCommandHelpResult = {
    type: 'Help'
    confidence: ParseCommandConfidence
}

/** Full description of the current room (examine surroundings); no Acme enrich. */
export type ParseCommandLookRoomResult = {
    type: 'LookRoom'
    confidence: ParseCommandConfidence
}

/** Trusted component look (UI click, link API) with explicit EphemeraId. Not produced by Bedrock parse. */
export type ParseCommandLookComponentResult = {
    type: 'LookComponent'
    componentId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId
    confidence: ParseCommandConfidence
    /** When true on Knowledge looks, fan-in targets SESSION#... */
    directResponse?: boolean
}

/** Trusted UI speech (Say / Narrate / OOC). Not produced by Bedrock parse. */
export type ParseCommandCharacterSpokeResult = {
    type: 'CharacterSpoke'
    message: string
    displayProtocol: CharacterSpeechDisplayProtocol
    confidence: ParseCommandConfidence
}

/** Coyote Game: explicit trigger for the Coyote engine test harness. */
export type ParseCommandCoyoteEngineTestResult = {
    type: 'CoyoteEngineTest'
    confidence: ParseCommandConfidence
    /** Populated by **`/test generation`** tail parse; forwarded to [`runCoyoteEngineTestHarness`](../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.ts). */
    harnessInvocation?: CoyoteEngineTestHarnessInvocation
}

/** Slash/actions parse payload for Acme affinities harness (default full run, optional single-fixture filter). */
export type CoyoteAffinitiesHarnessInvocation = {
    mode: 'full'
    /** 1-based fixture index into the locked affinities harness fixture list. */
    fixtureIndex1Based?: number
    /** When true, the affinities harness should use verbose/diagnostic behavior (e.g. legacy Acme enrich Step 1; other consumers may add more). */
    verbose?: boolean
}

export type AcmeOrderAffinitiesHarnessExpectedTrope = {
    trope: CoyoteTrope
    aptness: CoyoteTropeAptness
    narrowingLike: string
}

export type AcmeOrderAffinitiesHarnessExpectedLine = {
    nameLike: string
    valid: boolean
    errorType?: ParseCommandAcmeOrderErrorType
    tropeAffinities?: AcmeOrderAffinitiesHarnessExpectedTrope[]
}

export type AcmeOrderAffinitiesHarnessFixture = {
    id: string
    commandPhrase: string
    bucket?: 'clean' | 'borderline' | 'likely-misclassification'
    tags?: string[]
    expectedLines?: AcmeOrderAffinitiesHarnessExpectedLine[]
    likelyErrors?: string[]
}

/** Coyote Game: explicit trigger for the Acme parse affinities manual-review harness. */
export type ParseCommandCoyoteAffinitiesTestResult = {
    type: 'CoyoteAffinitiesTest'
    confidence: ParseCommandConfidence
    harnessInvocation?: CoyoteAffinitiesHarnessInvocation
}

export type ParseCommandUnimplementedResult = {
    type: 'Unimplemented'
    confidence: ParseCommandConfidence
}

export type ParseCommandUnknownResult = {
    type: 'Unknown'
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination / terminal parse: meta-instruction or jailbreak-style input (player-facing tone only; not a safety control).
 */
export type ParseCommandPromptInjectionAttemptResult = {
    type: 'PromptInjectionAttempt'
    confidence: ParseCommandConfidence
}

/**
 * Parser classified input as multiple user commands in one line.
 */
export type ParseCommandMultipleCommandsResult = {
    type: 'MultipleCommands'
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination only: model-classified movement intent before server-side exit resolution.
 * Final parse result still uses `Navigation` with `targetId` after resolution.
 */
export type ParseCommandNavigationIntentResult = {
    type: 'NavigationIntent'
    exitCandidate: string
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination only: model-classified return-home intent before server-side HomeId resolution.
 * Final parse result uses `Home` after resolution.
 */
export type ParseCommandHomeIntentResult = {
    type: 'HomeIntent'
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination only: player intent is an Acme order with **raw** product spans from the classifier.
 * Catalog validation, tropes, and **`stableKey`** are produced by Acme order enrich into {@link ParseCommandAcmeOrderResult}.
 * `parseCommand` runs enrich next; enrich may return {@link ParseCommandErrorResult} (for example when Coyote placement count exceeds the cap).
 */
export type ParseCommandAcmeOrderIntentResult = {
    type: 'AcmeOrderIntent'
    /** Unvalidated classifier-extracted product strings (trimmed). Not the same as {@link ParseCommandAcmeOrderResult.orders}. */
    rawOrders: string[]
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination only: player intent is to manipulate a scene object (pick up, drop, etc.).
 * `operationKind` and graph proposals belong in enrich; terminal outcomes are {@link ParseCommandObjectManipulationResult} or {@link ParseCommandErrorResult}.
 */
export type ParseCommandObjectManipulationIntentResult = {
    type: 'ObjectManipulationIntent'
    /** Unvalidated classifier-extracted object noun phrase strings (trimmed). Mapped from JSON `objectSpans`. */
    rawObjectSpans: string[]
    confidence: ParseCommandConfidence
}

/** Grounded atomic object manipulation after enrich + resolve (v1: `takeHold` only). */
export type ParseCommandObjectManipulationResult = {
    type: 'ObjectManipulation'
    operationKind: 'takeHold'
    objectId: EphemeraObjectId
    confidence: ParseCommandConfidence
}

/**
 * Outcome of intent discrimination only (includes Acme intent with **`rawOrders`** spans, and
 * `LookRoom` for full room description / examine-surroundings intent without Acme order enrich).
 */
export type IntentClassificationResult =
    | ParseCommandErrorResult
    | ParseCommandNavigationIntentResult
    | ParseCommandHomeIntentResult
    | ParseCommandAwaitRoadrunnerResult
    | ParseCommandPredictHypothesisResult
    | ParseCommandHelpResult
    | ParseCommandAcmeOrderIntentResult
    | ParseCommandObjectManipulationIntentResult
    | ParseCommandLookRoomResult
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult
    | ParseCommandPromptInjectionAttemptResult
    | ParseCommandMultipleCommandsResult

export type ParseCommandResult =
    | ParseCommandErrorResult
    | ParseCommandNavigationResult
    | ParseCommandHomeResult
    | ParseCommandAcmeOrderResult
    | ParseCommandAwaitRoadrunnerResult
    | ParseCommandPredictHypothesisResult
    | ParseCommandHelpResult
    | ParseCommandLookRoomResult
    | ParseCommandLookComponentResult
    | ParseCommandCharacterSpokeResult
    | ParseCommandCoyoteEngineTestResult
    | ParseCommandCoyoteAffinitiesTestResult
    | ParseCommandObjectManipulationResult
    | ParseCommandObjectManipulationIntentResult
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult
    | ParseCommandPromptInjectionAttemptResult
    | ParseCommandMultipleCommandsResult

export function isParseCommandErrorResult(
    result: ParseCommandResult
): result is ParseCommandErrorResult {
    return result.type === 'Error'
}

export function isParseCommandAwaitRoadrunnerResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandAwaitRoadrunnerResult {
    if (result.type !== 'AwaitRoadRunner') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandPredictHypothesisResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandPredictHypothesisResult {
    if (result.type !== 'PredictHypothesis') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandHelpResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandHelpResult {
    if (result.type !== 'Help') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandLookRoomResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandLookRoomResult {
    if (result.type !== 'LookRoom') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandLookComponentResult(
    result: ParseCommandResult
): result is ParseCommandLookComponentResult {
    if (result.type !== 'LookComponent') {
        return false
    }
    if (
        !isEphemeraRoomId(result.componentId)
        && !isEphemeraFeatureId(result.componentId)
        && !isEphemeraKnowledgeId(result.componentId)
    ) {
        return false
    }
    if (result.directResponse !== undefined && typeof result.directResponse !== 'boolean') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandCharacterSpokeResult(
    result: ParseCommandResult
): result is ParseCommandCharacterSpokeResult {
    if (result.type !== 'CharacterSpoke') {
        return false
    }
    if (typeof result.message !== 'string' || result.message.trim().length === 0) {
        return false
    }
    if (
        typeof result.displayProtocol !== 'string'
        || !CHARACTER_SPEECH_DISPLAY_PROTOCOLS.has(result.displayProtocol as CharacterSpeechDisplayProtocol)
    ) {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandNavigationResult(
    result: ParseCommandResult
): result is ParseCommandNavigationResult {
    if (result.type !== 'Navigation') {
        return false
    }
    return isEphemeraRoomId(result.targetId) && isParseConfidence(result.confidence)
}

export function isParseCommandHomeResult(
    result: ParseCommandResult
): result is ParseCommandHomeResult {
    if (result.type !== 'Home') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandAcmeOrderResult(
    result: ParseCommandResult
): result is ParseCommandAcmeOrderResult {
    if (result.type !== 'AcmeOrder') {
        return false
    }
    if (!isParseConfidence(result.confidence)) {
        return false
    }
    if (!Array.isArray(result.orders) || result.orders.length === 0) {
        return false
    }
    return result.orders.every((line) => {
        if (!line || typeof line !== 'object' || Array.isArray(line)) {
            return false
        }
        const entry = line as Record<string, unknown>
        if (typeof entry.valid !== 'boolean') {
            return false
        }
        if (typeof entry.name !== 'string') {
            return false
        }
        if (entry.name.trim().length === 0) {
            return false
        }
        if ('tropeAffinities' in entry) {
            if (!Array.isArray(entry.tropeAffinities)) {
                return false
            }
            if (entry.tropeAffinities.length > 3) {
                return false
            }
            if (!entry.tropeAffinities.every((x) => isCoyoteTropeAffinity(x))) {
                return false
            }
        }
        if ('tropeAffinitiesFailed' in entry && typeof entry.tropeAffinitiesFailed !== 'boolean') {
            return false
        }
        if (entry.tropeAffinitiesFailed === true && Array.isArray(entry.tropeAffinities) && entry.tropeAffinities.length !== 0) {
            return false
        }
        if (entry.valid === true) {
            if (entry.errorType !== undefined) {
                return false
            }
            const stableKeyRaw = entry.stableKey
            if (typeof stableKeyRaw !== 'string') {
                return false
            }
            if (stableKeyRaw.trim().length === 0) {
                return false
            }
            return true
        }
        if ('stableKey' in entry) {
            return false
        }
        if (!isParseCommandAcmeOrderErrorType(entry.errorType)) {
            return false
        }
        return true
    })
}

export function isParseCommandCoyoteEngineTestResult(
    result: ParseCommandResult
): result is ParseCommandCoyoteEngineTestResult {
    if (result.type !== 'CoyoteEngineTest') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandCoyoteAffinitiesTestResult(
    result: ParseCommandResult
): result is ParseCommandCoyoteAffinitiesTestResult {
    if (result.type !== 'CoyoteAffinitiesTest') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnimplementedResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandUnimplementedResult {
    if (result.type !== 'Unimplemented') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnknownResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandUnknownResult {
    if (result.type !== 'Unknown') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandPromptInjectionAttemptResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandPromptInjectionAttemptResult {
    if (result.type !== 'PromptInjectionAttempt') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandMultipleCommandsResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandMultipleCommandsResult {
    if (result.type !== 'MultipleCommands') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandObjectManipulationResult(
    result: ParseCommandResult
): result is ParseCommandObjectManipulationResult {
    if (result.type !== 'ObjectManipulation') {
        return false
    }
    return result.operationKind === 'takeHold' && isParseConfidence(result.confidence)
}

export type ParseCommandInput = {
    command: string
    roomExits?: {
        normalizedName: string
        targetId: EphemeraRoomId
    }[]
    /** Normalized shortNames for objects in the character's current room (classify prompt only). */
    roomObjectLabels?: string[]
    /** In-room object catalog for enrich and deterministic resolve (D6). */
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    /** Coyote-wide **`stableKey`** occupancy for Acme order enrich (omit or **[]** when unknown). */
    occupiedStableKeys?: readonly string[]
}

export type ParseCommandDeps = {
    /** Tests inject a mock; production uses Bedrock Nova via `invokeBedrockParseCommand` in generateExample. */
    invokeBedrockParseCommandImpl?: typeof invokeBedrockParseCommand;
    /** Second Bedrock call for Acme line enrichment; tests may inject a mock. */
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich;
    /** Bedrock enrich for object manipulation complexity stage; tests may inject a mock. */
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich;
    /** Bedrock identity stage for object manipulation; tests may inject a mock. */
    invokeBedrockObjectManipulationIdentityImpl?: typeof invokeBedrockObjectManipulationEnrich;
    /** Bedrock complexity stage for object manipulation; tests may inject a mock. */
    invokeBedrockObjectManipulationComplexityImpl?: typeof invokeBedrockObjectManipulationEnrich;
    /** Injectable Positions reads for object manipulation membership pre-gates. */
    objectManipulationPositionsReadDeps?: ObjectManipulationPositionsReadDeps;
    /** Injectable Coyote room/meta accessors for `countCoyotePlacedObjectsAcrossRooms` (Acme enrich pre-check). */
    countCoyotePlacedObjectsAcrossRoomsDeps?: Partial<CollectCoyoteOccupiedStableKeysDeps>;
    /** Deprecated compatibility flag; Acme enrich prompt is compact regardless of value. */
    debugAcmeOrderEnrichRationale?: boolean;
    /** When set, Acme enrich bootstrap/emit/finalize thinking jobs (see enrich/acmeOrder/acmeOrderThinkingPersistence). */
    messageBus?: Pick<MessageBus, 'publish'>;
}
