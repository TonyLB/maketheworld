import type { AcmeOrderEnrichModelLine, AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    ACME_ORDER_ENRICH_MAX_LINES,
    normalizeAcmeOrderStepBResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { extractJsonObjectText } from '../../llm/extractJsonObjectText'
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'
import type { ParseCommandAcmeOrderLine, ParseCommandAcmeOrderResult } from './baseClasses'

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n))
}

/** Strip chain-of-reasoning Markdown; keep only the JSON object substring for parsing. */
function jsonSliceForEnrichInterpret(raw: string): string {
    const split = splitMarkdownReasoningAndJson(raw)
    if (split.ok) {
        return split.jsonText
    }
    return extractJsonObjectText(raw)
}

export type InterpretAcmeOrderEnrichBodyOptions = {
    /** Single-row fallback **`name`** when Step B returns no **`lines`**. */
    emptyFallbackName?: string;
}

/**
 * Parses Step B JSON and normalizes **`lines`** via **`normalizeAcmeOrderStepBResponse`**.
 */
export function interpretAcmeOrderEnrichBody(
    body: string,
    options?: InterpretAcmeOrderEnrichBodyOptions
): {
    success: true;
    response: AcmeOrderEnrichModelResponse;
} | {
    success: false;
    errorMessage: string;
} {
    const toParse = jsonSliceForEnrichInterpret(body)
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
        const response = normalizeAcmeOrderStepBResponse(parsed, {
            emptyFallbackName: options?.emptyFallbackName,
        })
        if (response.lines.length > ACME_ORDER_ENRICH_MAX_LINES) {
            return {
                success: false,
                errorMessage: `Acme enrich interpret: at most ${ACME_ORDER_ENRICH_MAX_LINES} lines per order`,
            }
        }
        return { success: true, response }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, errorMessage: message }
    }
}

function enrichLineToParseLine(line: AcmeOrderEnrichModelLine): ParseCommandAcmeOrderLine {
    if (line.valid === false) {
        return {
            valid: false,
            name: line.name,
            errorType: line.errorType,
            affinities: [],
        }
    }
    return {
        valid: true,
        name: line.name,
        affinities: line.affinities,
        ...(line.affinitiesFailed !== undefined ? { affinitiesFailed: line.affinitiesFailed } : {}),
    }
}

/**
 * Builds **`ParseCommandAcmeOrderResult`** from Step A confidence and Step B output.
 * **`enrichInvokeFailed`**: transport failure or unparseable JSON — one synthetic failed row using **`commandFallbackName`**.
 */
export function finalizeAcmeOrderFromStepB(
    stepAConfidence: number,
    enrich: AcmeOrderEnrichModelResponse | null,
    enrichInvokeFailed: boolean,
    commandFallbackName: string
): ParseCommandAcmeOrderResult {
    if (enrichInvokeFailed || enrich === null) {
        return {
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: commandFallbackName.trim() || 'order',
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: stepAConfidence,
        }
    }

    const stepBConfidence = enrich.confidence ?? 1
    const orders = enrich.lines.map(enrichLineToParseLine)
    return {
        type: 'AcmeOrder',
        orders,
        confidence: clamp01(stepAConfidence * stepBConfidence),
    }
}
