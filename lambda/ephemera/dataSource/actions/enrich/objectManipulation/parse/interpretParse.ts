import { extractJsonObjectText } from '../../../../../llm/extractJsonObjectText'

import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import type { ParseTokenDraft } from './parseToken'

const forbiddenParseTokenFields = new Set([
    'id',
    'objectId',
    'ref',
    'stableRefKey',
    'role',
    'verb',
    'verbClass',
    'preposition',
    'relationKind',
    'disposition',
    'operationKind',
    'complexityClass',
])

function hasForbiddenParseTokenField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => forbiddenParseTokenFields.has(key))
}

function parseToken(value: unknown): { success: true; token: ParseTokenDraft } | { success: false; errorMessage: string } {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
    }
    const obj = value as Record<string, unknown>
    if (hasForbiddenParseTokenField(obj)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
    }
    if (obj.type === 'objectSpan') {
        if (typeof obj.span !== 'string' || obj.span.trim().length === 0) {
            return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
        }
        return { success: true, token: { type: 'objectSpan', span: obj.span.trim() } }
    }
    if (obj.type === 'text') {
        if (typeof obj.text !== 'string' || obj.text.trim().length === 0) {
            return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
        }
        return { success: true, token: { type: 'text', text: obj.text.trim() } }
    }
    return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
}

function parseTokens(value: unknown): { success: true; tokens: ParseTokenDraft[] } | { success: false; errorMessage: string } {
    if (!Array.isArray(value) || value.length === 0) {
        return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
    }
    const tokens: ParseTokenDraft[] = []
    for (const item of value) {
        const parsed = parseToken(item)
        if (!parsed.success) {
            return parsed
        }
        tokens.push(parsed.token)
    }
    return { success: true, tokens }
}

export function interpretParseBody(body: string): {
    success: true
    response: { tokens: ParseTokenDraft[] }
} | {
    success: false
    errorMessage: string
} {
    const toParse = extractJsonObjectText(body.trim())
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.parseParseFailed }
    }
    const tokensResult = parseTokens((parsed as Record<string, unknown>).tokens)
    if (!tokensResult.success) {
        return tokensResult
    }
    return { success: true, response: { tokens: tokensResult.tokens } }
}
