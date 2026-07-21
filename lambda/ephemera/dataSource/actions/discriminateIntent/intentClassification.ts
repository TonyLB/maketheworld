import type { IntentClassificationResult } from '../baseClasses'
import {
    isParseCommandCommandIntentResult,
    isParseCommandMultipleCommandsResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnknownResult,
    isParseCommandWorldQuestionIntentResult,
} from '../baseClasses'

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
 * Parses and validates LLM output for the narrowed (iteration 7, Sub-iteration 1)
 * intent-classification prompt. Accepts exactly **`Command`**, **`WorldQuestion`**,
 * **`MultipleCommands`**, **`PromptInjectionAttempt`**, or **`Unknown`**; anything else
 * (including any of the retired family-specific types, e.g. **`NavigationIntent`**,
 * **`AcmeOrder`**, **`ObjectMembershipIntent`**) becomes **`Error`**.
 * (**`CoyoteEngineTest`**, slash-only harness types, and deterministic bare-word / verb
 * fast paths are handled before Bedrock in **`parseCommand`** / **`deterministicChecks.ts`**.)
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

    if (type === 'Command') {
        const candidate: IntentClassificationResult = {
            type: 'Command',
            confidence: obj.confidence as number,
        }
        if (isParseCommandCommandIntentResult(candidate)) {
            return candidate
        }
    }

    if (type === 'WorldQuestion') {
        const candidate: IntentClassificationResult = {
            type: 'WorldQuestion',
            confidence: obj.confidence as number,
        }
        if (isParseCommandWorldQuestionIntentResult(candidate)) {
            return candidate
        }
    }

    if (type === 'MultipleCommands') {
        const candidate: IntentClassificationResult = {
            type: 'MultipleCommands',
            confidence: obj.confidence as number,
        }
        if (isParseCommandMultipleCommandsResult(candidate)) {
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
            'Model JSON must be a valid Command, WorldQuestion, MultipleCommands, PromptInjectionAttempt, or Unknown payload (see prompt)',
    }
}
