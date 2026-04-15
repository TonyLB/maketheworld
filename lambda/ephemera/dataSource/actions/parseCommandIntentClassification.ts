import type { ParseCommandResult } from './baseClasses'
import {
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'

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

function normalizeAcmeOrdersFromModel(obj: Record<string, unknown>): string[] | null {
    const fromArray = (value: unknown): string[] | null => {
        if (!Array.isArray(value)) {
            return null
        }
        const lines = value
            .filter((x): x is string => typeof x === 'string')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        return lines.length > 0 ? lines : null
    }

    const primary = fromArray(obj.orders)
    if (primary) {
        return primary
    }
    if (typeof obj.order === 'string' && obj.order.trim().length > 0) {
        return [obj.order.trim()]
    }
    return null
}

/**
 * Parses and validates LLM output for the intent-classification prompt.
 * Accepts `AwaitRoadRunner`, `AcmeOrder`, `Unimplemented`, or `Unknown`; anything else becomes `Error`.
 */
export function interpretParseCommandIntentClassificationBody(body: string): ParseCommandResult {
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
        const candidate: ParseCommandResult = {
            type: 'AwaitRoadRunner',
            confidence: obj.confidence as number,
        }
        if (isParseCommandAwaitRoadrunnerResult(candidate)) {
            return candidate
        }
    }

    if (type === 'AcmeOrder') {
        const orders = normalizeAcmeOrdersFromModel(obj)
        if (!orders) {
            return {
                type: 'Error',
                errorMessage: 'Model JSON AcmeOrder requires non-empty orders: string[] (or a single legacy order string)',
            }
        }
        const candidate: ParseCommandResult = {
            type: 'AcmeOrder',
            orders,
            confidence: obj.confidence as number,
        }
        if (isParseCommandAcmeOrderResult(candidate)) {
            return candidate
        }
    }

    if (type === 'Unimplemented') {
        const candidate: ParseCommandResult = {
            type: 'Unimplemented',
            confidence: obj.confidence as number,
        }
        if (isParseCommandUnimplementedResult(candidate)) {
            return candidate
        }
    }

    if (type === 'Unknown') {
        const candidate: ParseCommandResult = {
            type: 'Unknown',
            confidence: obj.confidence as number,
        }
        if (isParseCommandUnknownResult(candidate)) {
            return candidate
        }
    }

    return {
        type: 'Error',
        errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder, Unimplemented, or Unknown payload (see prompt)',
    }
}
