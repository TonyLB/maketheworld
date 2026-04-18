import type { AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    ACME_ORDER_ENRICH_MAX_LINES,
    normalizeAcmeOrderEnrichResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { ParseCommandAcmeOrderResult } from './baseClasses'

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n))
}

/** Strip markdown fences and extract a JSON object from the model response. */
export function extractJsonBodyFromModel(raw: string): string {
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

export type InterpretAcmeOrderEnrichBodyContext = {
    slotCount: number;
    fallbackNames: string[];
}

/**
 * Parses enrich JSON and normalizes each **`lines[i]`** to **`AcmeOrderEnrichModelLine`** (salvage or synthetic **`affinitiesFailed`**).
 * Fails only when the body is not JSON, not a plain object, slot count exceeds **`ACME_ORDER_ENRICH_MAX_LINES`**, or normalization throws.
 */
export function interpretAcmeOrderEnrichBody(
    body: string,
    context: InterpretAcmeOrderEnrichBodyContext
): {
    success: true;
    response: AcmeOrderEnrichModelResponse;
} | {
    success: false;
    errorMessage: string;
} {
    const { slotCount, fallbackNames } = context
    if (fallbackNames.length !== slotCount) {
        return { success: false, errorMessage: 'Acme enrich interpret: fallbackNames length must equal slotCount' }
    }
    if (slotCount > ACME_ORDER_ENRICH_MAX_LINES) {
        return {
            success: false,
            errorMessage: `Acme enrich interpret: at most ${ACME_ORDER_ENRICH_MAX_LINES} lines per order`,
        }
    }

    const toParse = extractJsonBodyFromModel(body)
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: 'Acme enrich model response was not valid JSON' }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: 'Acme enrich model response was not a JSON object' }
    }

    try {
        const response = normalizeAcmeOrderEnrichResponse(parsed, slotCount, fallbackNames)
        return { success: true, response }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, errorMessage: message }
    }
}

/**
 * Merges Step B enrich output into Step A orders. Per valid line, aligns **`lines[k]`** to the k-th valid row in order.
 * **`enrichInvokeFailed`**: transport failure or unparseable enrich JSON — mark every valid line **`affinitiesFailed`** and keep **`confidence`** at Step A only.
 */
export function mergeAcmeOrderWithEnrich(
    stepA: ParseCommandAcmeOrderResult,
    enrich: AcmeOrderEnrichModelResponse | null,
    enrichInvokeFailed: boolean
): ParseCommandAcmeOrderResult {
    const stepAConfidence = stepA.confidence
    const { orders } = stepA

    let enrichSlot = 0
    const merged = orders.map((line) => {
        if (!line.valid) {
            return line
        }

        if (enrichInvokeFailed || enrich === null) {
            return {
                ...line,
                affinities: [],
                affinitiesFailed: true,
            }
        }

        const eline = enrich.lines[enrichSlot]
        enrichSlot += 1

        if (eline === undefined) {
            return {
                ...line,
                affinities: [],
                affinitiesFailed: true,
            }
        }

        const catalogName = eline.name.trim() || line.name

        if (eline.affinitiesFailed === true) {
            return {
                ...line,
                name: catalogName,
                affinities: eline.affinities,
                affinitiesFailed: true,
            }
        }

        return {
            ...line,
            name: catalogName,
            affinities: eline.affinities,
        }
    })

    if (enrichInvokeFailed || enrich === null) {
        return {
            type: 'AcmeOrder',
            orders: merged,
            confidence: stepAConfidence,
        }
    }

    const stepBConfidence = enrich.confidence ?? 1
    return {
        type: 'AcmeOrder',
        orders: merged,
        confidence: clamp01(stepAConfidence * stepBConfidence),
    }
}
