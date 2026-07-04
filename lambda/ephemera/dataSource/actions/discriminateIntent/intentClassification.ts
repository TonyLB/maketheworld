import type {
    IntentClassificationResult,
    ManipulationVerbClass,
    ParseCommandAcmeOrderIntentResult,
    ParseCommandNavigationIntentResult,
    ParseCommandObjectManipulationIntentResult,
} from '../baseClasses'
import {
    isManipulationVerbClass,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandHelpResult,
    isParseCommandLookRoomResult,
    isParseCommandMultipleCommandsResult,
    isParseCommandPredictHypothesisResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from '../baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
    isParseCommandHomeIntentResult,
    isParseCommandNavigationIntentResult,
    isParseCommandObjectManipulationIntentResult,
} from './baseClasses'

function isParseConfidence(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

const forbiddenNavigationIntentFields = new Set([
    'targetId',
    'toRoomId',
    'roomId',
    'destinationId',
    'fromRoomId',
])

const forbiddenHomeIntentFields = new Set([
    'targetId',
    'toRoomId',
    'roomId',
    'destinationId',
    'fromRoomId',
    'exitCandidate',
])

const forbiddenObjectManipulationIntentFields = new Set([
    'operationKind',
    'disposition',
    'objectId',
    'targetId',
    'targetRoomId',
    'fromRoomId',
    'toRoomId',
    'roomId',
    'destinationId',
    'exitCandidate',
    'orders',
    'rawObjectSpans',
])

function hasForbiddenObjectManipulationIntentField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => {
        if (forbiddenObjectManipulationIntentFields.has(key)) {
            return true
        }
        return /id$/i.test(key) && /(target|room|destination|to|from|object|exit)/i.test(key)
    })
}

function hasForbiddenHomeIntentField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => {
        if (forbiddenHomeIntentFields.has(key)) {
            return true
        }
        return /id$/i.test(key) && /(target|room|destination|to|from|exit)/i.test(key)
    })
}

function hasForbiddenNavigationIntentField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => {
        if (forbiddenNavigationIntentFields.has(key)) {
            return true
        }
        return /id$/i.test(key) && /(target|room|destination|to|from)/i.test(key)
    })
}

function parseAcmeOrderIntentRawOrders(obj: Record<string, unknown>): { rawOrders: string[] } | { error: string } {
    if (!('orders' in obj)) {
        return { error: 'AcmeOrder intent payload must include orders array of raw product spans' }
    }
    if (!Array.isArray(obj.orders)) {
        return { error: 'AcmeOrder intent orders must be a non-empty array of strings' }
    }
    const rawOrders: string[] = []
    for (const element of obj.orders) {
        if (typeof element !== 'string') {
            return { error: 'AcmeOrder intent orders must contain only non-empty strings' }
        }
        const trimmed = element.trim()
        if (trimmed.length === 0) {
            return { error: 'AcmeOrder intent orders entries must be non-empty after trim' }
        }
        rawOrders.push(trimmed)
    }
    if (rawOrders.length === 0) {
        return { error: 'AcmeOrder intent orders array must be non-empty' }
    }
    return { rawOrders }
}

function parseObjectManipulationIntentRawObjectSpans(
    obj: Record<string, unknown>
): { rawObjectSpans: string[] } | { error: string } {
    if ('rawObjectSpans' in obj) {
        return { error: 'ObjectManipulationIntent intent payload must use objectSpans, not rawObjectSpans' }
    }
    if ('orders' in obj) {
        return { error: 'ObjectManipulationIntent intent payload must not use orders field' }
    }
    if (!('objectSpans' in obj)) {
        return { error: 'ObjectManipulationIntent intent payload must include objectSpans array of raw object spans' }
    }
    if (!Array.isArray(obj.objectSpans)) {
        return { error: 'ObjectManipulationIntent intent objectSpans must be a non-empty array of strings' }
    }
    const rawObjectSpans: string[] = []
    for (const element of obj.objectSpans) {
        if (typeof element !== 'string') {
            return { error: 'ObjectManipulationIntent intent objectSpans must contain only non-empty strings' }
        }
        const trimmed = element.trim()
        if (trimmed.length === 0) {
            return { error: 'ObjectManipulationIntent intent objectSpans entries must be non-empty after trim' }
        }
        rawObjectSpans.push(trimmed)
    }
    if (rawObjectSpans.length === 0) {
        return { error: 'ObjectManipulationIntent intent objectSpans array must be non-empty' }
    }
    return { rawObjectSpans }
}

function parseObjectManipulationIntentVerbClass(
    obj: Record<string, unknown>
): { verbClass: ManipulationVerbClass } | { error: string } {
    if (!('verbClass' in obj)) {
        return { error: 'ObjectManipulationIntent intent payload must include verbClass acquire or release' }
    }
    if (!isManipulationVerbClass(obj.verbClass)) {
        return { error: 'ObjectManipulationIntent intent verbClass must be acquire or release' }
    }
    return { verbClass: obj.verbClass }
}

/** Strip markdown code fences and extract a JSON object from the model response. */
function extractJsonBody(raw: string): string {
    let s = raw.trim()
    const openFence = /^```(?:json)?\s*\n?/i
    const closeFence = /\n?```\s*$/
    s = s.replace(openFence, '').replace(closeFence, '').trim()
    const firstBrace = s.indexOf('{')
    if (firstBrace === -1) return s
    const lastBrace = s.lastIndexOf('}')
    if (lastBrace === -1 || lastBrace <= firstBrace) return s
    return s.slice(firstBrace, lastBrace + 1)
}

/**
 * Parses and validates LLM output for the intent-classification prompt.
 * Accepts **`MultipleCommands`**, **`PromptInjectionAttempt`**, **`AwaitRoadRunner`**, **`PredictHypothesis`**, **`AcmeOrder`** (with **`orders`**: raw product spans mapped to **`rawOrders`**),
 * **`ObjectManipulationIntent`** (with **`objectSpans`**: raw object spans mapped to **`rawObjectSpans`**),
 * **`LookRoom`**, **`Help`**, **`NavigationIntent`**, **`HomeIntent`**, **`Unimplemented`**, or **`Unknown`**; anything else becomes **`Error`**.
 * (**`CoyoteEngineTest`**, slash-only harness types, and deterministic **bare `look` / `l` / `help`** are handled before Bedrock in **`parseCommand`**.)
 */
export function interpretIntentClassificationBody(body: string): IntentClassificationResult {
    const toParse = extractJsonBody(body)
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return {
            type: 'Error',
            errorMessage: 'Model response was not valid JSON',
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
            type: 'Error',
            errorMessage: 'Model JSON was not a single object',
        }
    }

    const obj = parsed as Record<string, unknown>
    const type = obj.type

    if (type === 'MultipleCommands') {
        const candidate: IntentClassificationResult = {
            type: 'MultipleCommands',
            confidence: obj.confidence as number,
        }
        if (isParseCommandMultipleCommandsResult(candidate)) {
            return candidate
        }
    }

    if (type === 'AwaitRoadRunner') {
        const candidate: IntentClassificationResult = {
            type: 'AwaitRoadRunner',
            confidence: obj.confidence as number,
        }
        if (isParseCommandAwaitRoadrunnerResult(candidate)) {
            return candidate
        }
    }

    if (type === 'PredictHypothesis') {
        const candidate: IntentClassificationResult = {
            type: 'PredictHypothesis',
            confidence: obj.confidence as number,
        }
        if (isParseCommandPredictHypothesisResult(candidate)) {
            return candidate
        }
    }

    if (type === 'LookRoom') {
        const candidate: IntentClassificationResult = {
            type: 'LookRoom',
            confidence: obj.confidence as number,
        }
        if (isParseCommandLookRoomResult(candidate)) {
            return candidate
        }
    }

    if (type === 'Help') {
        const candidate: IntentClassificationResult = {
            type: 'Help',
            confidence: obj.confidence as number,
        }
        if (isParseCommandHelpResult(candidate)) {
            return candidate
        }
    }

    if (type === 'HomeIntent') {
        if (hasForbiddenHomeIntentField(obj)) {
            return {
                type: 'Error',
                errorMessage: 'HomeIntent must not include room-id routing fields',
            }
        }
        const candidate = {
            type: 'HomeIntent' as const,
            confidence: obj.confidence as number,
        }
        if (isParseCommandHomeIntentResult(candidate)) {
            return candidate
        }
    }

    if (type === 'NavigationIntent') {
        if (hasForbiddenNavigationIntentField(obj)) {
            return {
                type: 'Error',
                errorMessage: 'NavigationIntent must not include room-id routing fields',
            }
        }
        const candidate: ParseCommandNavigationIntentResult = {
            type: 'NavigationIntent',
            exitCandidate: obj.exitCandidate as string,
            confidence: obj.confidence as number,
        }
        if (isParseCommandNavigationIntentResult(candidate)) {
            return {
                ...candidate,
                exitCandidate: candidate.exitCandidate.trim(),
            }
        }
    }

    if (type === 'AcmeOrder') {
        if (typeof obj.order === 'string') {
            return {
                type: 'Error',
                errorMessage: 'AcmeOrder intent payload must not include legacy order field',
            }
        }
        const parsedOrders = parseAcmeOrderIntentRawOrders(obj)
        if ('error' in parsedOrders) {
            return { type: 'Error', errorMessage: parsedOrders.error }
        }
        const candidate: ParseCommandAcmeOrderIntentResult = {
            type: 'AcmeOrderIntent',
            rawOrders: parsedOrders.rawOrders,
            confidence: obj.confidence as number,
        }
        if (isParseCommandAcmeOrderIntentResult(candidate)) {
            return candidate
        }
    }

    if (type === 'ObjectManipulationIntent') {
        if (hasForbiddenObjectManipulationIntentField(obj)) {
            return {
                type: 'Error',
                errorMessage: 'ObjectManipulationIntent must not include operationKind, disposition, object ids, or routing fields',
            }
        }
        const parsedObjectSpans = parseObjectManipulationIntentRawObjectSpans(obj)
        if ('error' in parsedObjectSpans) {
            return { type: 'Error', errorMessage: parsedObjectSpans.error }
        }
        const parsedVerbClass = parseObjectManipulationIntentVerbClass(obj)
        if ('error' in parsedVerbClass) {
            return { type: 'Error', errorMessage: parsedVerbClass.error }
        }
        const candidate: ParseCommandObjectManipulationIntentResult = {
            type: 'ObjectManipulationIntent',
            rawObjectSpans: parsedObjectSpans.rawObjectSpans,
            verbClass: parsedVerbClass.verbClass,
            confidence: obj.confidence as number,
        }
        if (isParseCommandObjectManipulationIntentResult(candidate)) {
            return candidate
        }
    }

    if (type === 'Unimplemented') {
        const candidate: IntentClassificationResult = {
            type: 'Unimplemented',
            confidence: obj.confidence as number,
        }
        if (isParseCommandUnimplementedResult(candidate)) {
            return candidate
        }
    }

    if (type === 'Unknown') {
        const candidate: IntentClassificationResult = {
            type: 'Unknown',
            confidence: obj.confidence as number,
        }
        if (isParseCommandUnknownResult(candidate)) {
            return candidate
        }
    }

    if (type === 'PromptInjectionAttempt') {
        const candidate: IntentClassificationResult = {
            type: 'PromptInjectionAttempt',
            confidence: obj.confidence as number,
        }
        if (isParseCommandPromptInjectionAttemptResult(candidate)) {
            return candidate
        }
    }

    return {
        type: 'Error',
        errorMessage:
            'Model JSON must be a valid MultipleCommands, PromptInjectionAttempt, AwaitRoadRunner, PredictHypothesis, AcmeOrder (orders array of raw spans), ObjectManipulationIntent (objectSpans array of raw spans and verbClass acquire or release), LookRoom, Help, NavigationIntent, HomeIntent, Unimplemented, or Unknown payload (see prompt)',
    }
}
