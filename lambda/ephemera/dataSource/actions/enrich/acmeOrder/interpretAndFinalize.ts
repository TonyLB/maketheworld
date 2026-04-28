import type { AcmeOrderEnrichModelLine, AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    ACME_ORDER_ENRICH_MAX_LINES,
    defaultStableKeyProposal,
    normalizeAcmeOrderEnrichResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { extractJsonObjectText } from '../../../../llm/extractJsonObjectText'
import { splitMarkdownReasoningAndJson } from '../../../../llm/splitMarkdownReasoningAndJson'
import type { ParseCommandAcmeOrderLine, ParseCommandAcmeOrderResult } from '../../baseClasses'

const ACME_ENRICH_NORMALIZE_ECHO_DEBUG = false

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n))
}

export type InterpretAcmeOrderEnrichBodySuccess = {
    success: true;
    response: AcmeOrderEnrichModelResponse;
    /** Leading Markdown chain-of-reason before the JSON payload; empty when absent or fallback path. */
    reasoningMarkdown: string;
}

function splitBodyForEnrichInterpret(raw: string): { jsonText: string; reasoningMarkdown: string } {
    const split = splitMarkdownReasoningAndJson(raw)
    if (split.ok) {
        return {
            jsonText: split.jsonText,
            reasoningMarkdown: split.reasoningMarkdown.trim(),
        }
    }
    return {
        jsonText: extractJsonObjectText(raw),
        reasoningMarkdown: '',
    }
}

export type InterpretAcmeOrderEnrichBodyOptions = {
    /** Single-row fallback **`name`** when Acme order enrich returns no **`lines`**. */
    emptyFallbackName?: string;
}

/**
 * Parses Acme order enrich JSON and normalizes **`lines`** via **`normalizeAcmeOrderEnrichResponse`**.
 * Returns **`reasoningMarkdown`** alongside **`response`** when **`success`** (possibly empty).
 */
export function interpretAcmeOrderEnrichBody(
    body: string,
    options?: InterpretAcmeOrderEnrichBodyOptions
): InterpretAcmeOrderEnrichBodySuccess | {
    success: false;
    errorMessage: string;
} {
    const { jsonText: toParse, reasoningMarkdown } = splitBodyForEnrichInterpret(body)
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
        const parsedRoot = parsed as Record<string, unknown>
        const rawLines = Array.isArray(parsedRoot.lines) ? parsedRoot.lines : []
        const response = normalizeAcmeOrderEnrichResponse(parsed, {
            emptyFallbackName: options?.emptyFallbackName,
        })
        response.lines.forEach((line, index) => {
            if (!ACME_ENRICH_NORMALIZE_ECHO_DEBUG) {
                return
            }
            if (!line.valid || line.tropeAffinitiesFailed !== true) {
                return
            }
            const rawLine = rawLines[index]
            const rawLineObject = (rawLine && typeof rawLine === 'object' && !Array.isArray(rawLine))
                ? (rawLine as Record<string, unknown>)
                : null
            const rawLineJson = (() => {
                try {
                    return JSON.stringify(rawLine)
                } catch {
                    return '[unserializable rawLine]'
                }
            })()
            const rawTropeAffinitiesJson = (() => {
                try {
                    return JSON.stringify(rawLineObject?.tropeAffinities)
                } catch {
                    return '[unserializable raw tropeAffinities]'
                }
            })()
            console.log('[mtw.ephemera.acmeEnrich.normalizeEcho] trope_affinities_failed', {
                line: index + 1,
                name: line.name,
                stableKey: line.stableKey,
                tropeAffinitiesLength: line.tropeAffinities?.length ?? 0,
                tropeAffinitiesFailed: line.tropeAffinitiesFailed,
                rawHasTropeAffinitiesField: rawLineObject
                    ? Object.prototype.hasOwnProperty.call(rawLineObject, 'tropeAffinities')
                    : false,
                rawTropeAffinitiesLength: rawLineObject && Array.isArray(rawLineObject.tropeAffinities)
                    ? rawLineObject.tropeAffinities.length
                    : undefined,
                rawTropeAffinitiesFailed: rawLineObject?.tropeAffinitiesFailed,
                rawLine,
                rawLineJson,
                rawTropeAffinitiesJson,
                note: 'Post-normalization line has tropeAffinitiesFailed=true',
            })
        })
        if (response.lines.length > ACME_ORDER_ENRICH_MAX_LINES) {
            return {
                success: false,
                errorMessage: `Acme enrich interpret: at most ${ACME_ORDER_ENRICH_MAX_LINES} lines per order`,
            }
        }
        return { success: true, response, reasoningMarkdown }
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
        stableKey: line.stableKey,
        tropeAffinities: line.tropeAffinities ?? [],
        tropeAffinitiesFailed: line.tropeAffinitiesFailed === true || (line.tropeAffinities ?? []).length === 0,
        // Phase 0 compatibility contract: keep legacy role fields shape-valid but semantically retired.
        affinities: [],
        affinitiesFailed: true,
    }
}

/**
 * Builds **`ParseCommandAcmeOrderResult`** from intent-discrimination confidence and Acme order enrich output.
 * **`enrichInvokeFailed`**: transport failure or unparseable JSON — one synthetic failed row using **`commandFallbackName`**.
 */
export function finalizeAcmeOrderFromEnrich(
    intentConfidence: number,
    enrich: AcmeOrderEnrichModelResponse | null,
    enrichInvokeFailed: boolean,
    commandFallbackName: string
): ParseCommandAcmeOrderResult {
    if (enrichInvokeFailed || enrich === null) {
        const name = commandFallbackName.trim() || 'order'
        return {
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name,
                stableKey: defaultStableKeyProposal(name),
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: intentConfidence,
        }
    }

    const enrichConfidence = enrich.confidence ?? 1
    const orders = enrich.lines.map(enrichLineToParseLine)
    return {
        type: 'AcmeOrder',
        orders,
        confidence: clamp01(intentConfidence * enrichConfidence),
    }
}
