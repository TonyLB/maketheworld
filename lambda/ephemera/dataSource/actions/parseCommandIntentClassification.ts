import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { ParseCommandResult } from './baseClasses'
import {
    type ParseCommandAcmeOrderErrorType,
    type ParseCommandAcmeOrderLine,
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'

function parseAffinitiesField(raw: unknown): CoyoteAffinityPossibility[] {
    if (!Array.isArray(raw)) {
        return []
    }
    return raw.filter((x): x is CoyoteAffinityPossibility => isCoyoteAffinityPossibility(x))
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

function normalizeAcmeOrdersFromModel(obj: Record<string, unknown>): ParseCommandAcmeOrderLine[] | null {
    const isErrorType = (value: unknown): value is ParseCommandAcmeOrderErrorType => (
        value === 'Not a thing' || value === 'Not tangible' || value === 'Too large'
    )

    const fromLineArray = (value: unknown): ParseCommandAcmeOrderLine[] | null => {
        if (!Array.isArray(value)) {
            return null
        }
        const lines = value
            .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x))
            .map((entry): ParseCommandAcmeOrderLine | null => {
                if (typeof entry.valid !== 'boolean') {
                    return null
                }
                const name = typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name.trim() : null
                if (!name) {
                    return null
                }
                const errorType = isErrorType(entry.errorType) ? entry.errorType : undefined
                if (entry.valid && errorType !== undefined) {
                    return null
                }
                if (!entry.valid && errorType === undefined) {
                    return null
                }
                if (!entry.valid && errorType !== undefined) {
                    return {
                        valid: false,
                        name,
                        affinities: [],
                        errorType,
                    }
                }
                let affinities = parseAffinitiesField(entry.affinities)
                const affinitiesFailed = typeof entry.affinitiesFailed === 'boolean'
                    ? entry.affinitiesFailed
                    : undefined
                if (affinitiesFailed === true) {
                    affinities = []
                }
                const base: ParseCommandAcmeOrderLine = {
                    valid: true,
                    name,
                    affinities,
                    ...(affinitiesFailed !== undefined ? { affinitiesFailed } : {}),
                }
                return base
            })
            .filter((x): x is ParseCommandAcmeOrderLine => x !== null)
        return lines.length > 0 ? lines : null
    }

    const fromStringArray = (value: unknown): ParseCommandAcmeOrderLine[] | null => {
        if (!Array.isArray(value)) {
            return null
        }
        const lines = value
            .filter((x): x is string => typeof x === 'string')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((name): ParseCommandAcmeOrderLine => ({
                valid: true,
                name,
                affinities: [],
            }))
        return lines.length > 0 ? lines : null
    }

    const primary = fromLineArray(obj.orders) ?? fromStringArray(obj.orders)
    if (primary) {
        return primary
    }
    if (typeof obj.order === 'string' && obj.order.trim().length > 0) {
        return [{
            valid: true,
            name: obj.order.trim(),
            affinities: [],
        }]
    }
    return null
}

/**
 * Parses and validates LLM output for the intent-classification prompt.
 * Accepts **`AwaitRoadRunner`**, **`AcmeOrder`**, **`Unimplemented`**, or **`Unknown`**; anything else becomes **`Error`**.
 * (**`CoyoteEngineTest`** is handled deterministically before Bedrock in **`parseCommand`**.)
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
                errorMessage: 'Model JSON AcmeOrder requires non-empty orders with per-line validity or legacy order strings',
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
