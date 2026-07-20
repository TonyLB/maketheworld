//
// Parse's tokenized command skeleton (BD-21): an ordered sequence of referent spans and
// leftover text runs, deliberately with no grammatical (verb/preposition) classification --
// Plan owns keyword/pattern matching over the text runs (see matchRelationalTemplate.ts);
// tagging verb/preposition at Parse's layer was rejected as an untested classification with
// no schema precedent (full rationale in git history).
//

export type TextToken = {
    type: 'text'
    text: string
}

/**
 * The shape Parse's LLM actually emits -- no stableRefKey. Nothing generates that key
 * until stampStableRefKeys.ts runs, since assigning it is bookkeeping, not language.
 */
export type ObjectSpanTokenDraft = {
    type: 'objectSpan'
    span: string
}

export type ParseTokenDraft = ObjectSpanTokenDraft | TextToken

/**
 * The final, stamped shape -- stableRefKey identifies this occurrence (not the
 * real-world object it may resolve to) stably across the rest of the pipeline for
 * this command, so later stages (Grounding, backtrack critiques) can reference a
 * specific referent without relying on raw array position.
 */
export type ObjectSpanToken = ObjectSpanTokenDraft & {
    stableRefKey: string
}

export type ParseToken = ObjectSpanToken | TextToken

export type ParseSkeleton = ParseToken[]
