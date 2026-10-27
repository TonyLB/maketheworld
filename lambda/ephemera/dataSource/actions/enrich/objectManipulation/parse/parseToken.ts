//
// Parse's tokenized command skeleton (BD-21): an ordered sequence of referent spans and
// leftover text runs, deliberately with no grammatical (verb/preposition) classification --
// Plan owns keyword/pattern matching over the text runs (see the templates under plan/);
// tagging verb/preposition at Parse's layer was rejected as an untested classification with
// no schema precedent (full rationale in git history). Parse's skeleton is always flat: a
// span's `qualifier` is added in a reading of Plan's templates (an object phrase's fill), never by Parse.
//

import type { SpanCatalog } from '../../../deterministicTemplate/deterministicTemplate'

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
 * What a span's tokens say about how else the command reads (`AGENT.skeletonMatcher.planning.md`
 * SM-4): its own tokens, each as text, and the proper sub-runs of them that another complete
 * reading of the command reads as a span of its own, as token ranges (start inclusive, end
 * exclusive) relative to the span's first token. Identify derives character ranges itself.
 */
export type SpanStructure = {
    tokens: string[]
    alternatives: { start: number; end: number }[]
}

/**
 * The final, stamped shape -- stableRefKey identifies this occurrence (not the
 * real-world object it may resolve to) stably across the rest of the pipeline for
 * this command, so later stages (Grounding, backtrack critiques) can reference a
 * specific referent without relying on raw array position.
 */
export type ObjectSpanToken = ObjectSpanTokenDraft & {
    stableRefKey: string
    /** What the span grounds against, as its template's slot declares (`SpanCatalog`); absent, the objects. */
    catalog?: SpanCatalog
    /** Present only when another complete reading cuts inside the span (`readFills`). */
    structure?: SpanStructure
    /** Where the thing is said to be ("the cup on the table"): set in a reading of Plan's templates, read by lowering (`plan/lowerQualifiers.ts`). */
    qualifier?: SpanQualifier
}

/**
 * A closed-set restricting preposition, canonical (the LLM's `out` reads as `out of`). Which
 * relation each records is `QUALIFIER_PREPOSITIONS` in `plan/qualifierPrepositions.ts`.
 */
export type QualifierPreposition = 'on' | 'on top of' | 'off' | 'in' | 'inside' | 'out of' | 'from'

/** A qualifier on a span: the preposition, and the span naming the host --- the flat skeleton's own token, with its own key. */
export type SpanQualifier = {
    preposition: QualifierPreposition
    span: ObjectSpanToken
}

export type ParseToken = ObjectSpanToken | TextToken

export type ParseSkeleton = ParseToken[]
