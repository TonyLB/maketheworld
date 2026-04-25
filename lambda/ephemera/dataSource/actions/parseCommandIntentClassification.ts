import type {
    IntentClassificationResult,
    ParseCommandAcmeOrderIntentResult,
} from './baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandLookRoomResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'

function isParseConfidence(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
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
 * Accepts **`AwaitRoadRunner`**, **`AcmeOrder`** (intent-only, no **`orders`**), **`LookRoom`**, **`Unimplemented`**, or **`Unknown`**; anything else becomes **`Error`**.
 * (**`CoyoteEngineTest`**, slash-only harness types, and **bare `look` / `l`** are handled deterministically before Bedrock in **`parseCommand`**.)
 */
export function interpretParseCommandIntentClassificationBody(body: string): IntentClassificationResult {
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

    if (type === 'AwaitRoadRunner') {
        const candidate: IntentClassificationResult = {
            type: 'AwaitRoadRunner',
            confidence: obj.confidence as number,
        }
        if (isParseCommandAwaitRoadrunnerResult(candidate)) {
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

    if (type === 'AcmeOrder') {
        if ('orders' in obj && Array.isArray(obj.orders) && obj.orders.length > 0) {
            return {
                type: 'Error',
                errorMessage: 'Step A AcmeOrder must not include orders array; segmentation is handled in Step B',
            }
        }
        if (typeof obj.order === 'string') {
            return {
                type: 'Error',
                errorMessage: 'Step A AcmeOrder must not include legacy order field; segmentation is handled in Step B',
            }
        }
        const candidate: ParseCommandAcmeOrderIntentResult = {
            type: 'AcmeOrderIntent',
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

    return {
        type: 'Error',
        errorMessage:
            'Model JSON must be a valid AwaitRoadRunner, AcmeOrder (confidence only), LookRoom, Unimplemented, or Unknown payload (see prompt)',
    }
}
