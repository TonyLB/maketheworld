//
// Split model output into leading Markdown (chain-of-reasoning) vs final JSON substring.
//

import { extractJsonObjectText } from './extractJsonObjectText'
import { findAllFenceBlocks } from './markdownCodeFences'

export type SplitMarkdownReasoningAndJsonResult =
    | { ok: true; reasoningMarkdown: string; jsonText: string }
    | { ok: false; errorMessage: string }

/**
 * If the body ends with a fenced block (``` or ```json), returns the span after the **last**
 * opening fence line and before the closing ```.
 * Markdown before that fence is reasoning. Fails closed if the closing fence is missing.
 */
function trySplitTrailingJsonFence(trimmed: string): { reasoning: string; jsonInner: string } | null {
    if (!trimmed.endsWith('```')) return null

    const openPattern = /\n```(?:json)?\s*\r?\n/gi
    let lastOpenStart = -1
    let lastOpenLen = 0
    let m: RegExpExecArray | null
    while ((m = openPattern.exec(trimmed)) !== null) {
        lastOpenStart = m.index
        lastOpenLen = m[0].length
    }

    let jsonStartOffset = -1
    let reasoningEnd = -1

    if (lastOpenStart !== -1) {
        jsonStartOffset = lastOpenStart + lastOpenLen
        reasoningEnd = lastOpenStart
    } else {
        const head = trimmed.match(/^```(?:json)?\s*\r?\n/i)
        if (!head) return null
        jsonStartOffset = head[0].length
        reasoningEnd = 0
    }

    const afterOpen = trimmed.slice(jsonStartOffset)
    const closeRel = afterOpen.search(/\r?\n```\s*$/)
    if (closeRel === -1) return null

    const jsonInner = afterOpen.slice(0, closeRel)
    const reasoning = reasoningEnd === 0 ? '' : trimmed.slice(0, reasoningEnd).trim()

    return { reasoning, jsonInner }
}

/**
 * When the body doesn't end in a fence, the **last** fenced block tagged **json** (or untagged) whose
 * interior is a JSON object, wherever it sits: a model often comments after its block, and sometimes
 * writes a draft block, reasons on, and writes the full block after it (playByPlay, batch 37), where
 * the first-brace-to-last-brace slice would span both. Prose after the block is dropped.
 */
function tryLastJsonFence(trimmed: string): { reasoning: string; jsonText: string } | null {
    const blocks = findAllFenceBlocks(trimmed).filter(({ lang, interior }) => (lang === '' || lang.toLowerCase() === 'json') && interior.trim().startsWith('{'))
    const block = blocks[blocks.length - 1]
    return block === undefined ? null : { reasoning: trimmed.slice(0, block.start).trim(), jsonText: extractJsonObjectText(block.interior) }
}

/**
 * Splits **Markdown reasoning** (optional) from a final **JSON object** substring.
 *
 * 1. Prefer a **trailing** triple-backtick code block tagged **json** (last such fence in the body):
 *    reasoning is everything before that opening fence; JSON is taken from the fenced inner text.
 * 2. Otherwise the **last** fenced **json** (or untagged) block holding an object, with prose after
 *    it dropped ({@link tryLastJsonFence}).
 * 3. Otherwise strip optional full-body fences and use the **first `{` … last `}`** slice (same
 *    heuristic as {@link extractJsonObjectText}); reasoning is the trimmed prefix before the JSON
 *    slice when it appears verbatim in the input.
 *
 * If prose before JSON contains `{` / `}` outside fences, prefer a fenced JSON tail in the prompt.
 * This function does not validate JSON beyond ensuring a non-empty `{`-led object slice exists.
 */
export function splitMarkdownReasoningAndJson(raw: string): SplitMarkdownReasoningAndJsonResult {
    const trimmed = raw.trim()
    if (!trimmed) {
        return { ok: false, errorMessage: 'Empty model response' }
    }

    const fenceSplit = trySplitTrailingJsonFence(trimmed)
    if (fenceSplit) {
        const jsonText = extractJsonObjectText(fenceSplit.jsonInner)
        if (!jsonText.trim().startsWith('{')) {
            return {
                ok: false,
                errorMessage: 'Trailing fenced block did not contain a JSON object',
            }
        }
        return {
            ok: true,
            reasoningMarkdown: fenceSplit.reasoning.trim(),
            jsonText,
        }
    }

    const lastFence = tryLastJsonFence(trimmed)
    if (lastFence) {
        return { ok: true, reasoningMarkdown: lastFence.reasoning, jsonText: lastFence.jsonText }
    }

    const jsonText = extractJsonObjectText(trimmed)
    if (jsonText.trim().length === 0 || !jsonText.trim().startsWith('{')) {
        return { ok: false, errorMessage: 'No JSON object found in model response' }
    }

    let reasoningEnd = trimmed.indexOf(jsonText)
    if (reasoningEnd === -1) {
        const fb = trimmed.indexOf('{')
        reasoningEnd = fb === -1 ? 0 : fb
    }

    const reasoningMarkdown = trimmed.slice(0, reasoningEnd).trim()
    return { ok: true, reasoningMarkdown, jsonText }
}
