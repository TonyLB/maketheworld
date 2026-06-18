import type {
    IntentClassificationResult,
    ParseCommandAcmeOrderIntentResult,
    ParseCommandNavigationIntentResult,
} from '../baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
    isParseCommandHomeIntentResult,
    isParseCommandNavigationIntentResult,
} from './baseClasses'
import {
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandHelpResult,
    isParseCommandLookRoomResult,
    isParseCommandMultipleCommandsResult,
    isParseCommandPredictHypothesisResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from '../baseClasses'

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
            'Model JSON must be a valid MultipleCommands, PromptInjectionAttempt, AwaitRoadRunner, PredictHypothesis, AcmeOrder (orders array of raw spans), LookRoom, Help, NavigationIntent, HomeIntent, Unimplemented, or Unknown payload (see prompt)',
    }
}
