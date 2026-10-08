import type { NarrationPart } from '../../positions/manipulation/kernel/kernelStep'

/**
 * Declares *which rooms* get a witness variant's line, without naming a host: `refs` name things
 * the covered actions' sentence is about, and `phase` is when those things' presence is read ---
 * `before` the covered actions, `after` them. A ref is a referent's `stableRefKey`, its
 * `derivedReferentKey` for a born-grounded `graphNode` (no phrase named it, so it has no
 * `stableRefKey`: Expansion's dissolve ends), or `'actor'`. Authors reason about the things in the
 * sentence; resolving a ref to a room is a compile-time concern (`AGENT.attemptNarration.planning.md`'s
 * AN-7 stage 2), not this value's.
 */
export type NarrationAudience = {
    refs: string[]
    phase: 'before' | 'after'
}

/**
 * One deliverable line: unfilled template parts plus the one audience they go to (AN-2's witness
 * axis). A `ref` part names a thing the same way an audience ref does; the actor's name and every
 * ref's label are filled at delivery (`commitAttempt` resolves them once per attempt), since an
 * author upstream of commit (Expansion) cannot know display names, and filling late keeps second
 * person and per-viewer naming possible. Variants are entries in one `NarrationUnit`, not separate
 * narration units, because every variant's validity is identical --- only text and audience differ,
 * and delivery must not drop one audience's line while delivering another's. A future role variant
 * (RN-1, deferred) adds as another entry of this same shape (keyed by role instead of audience),
 * not a new field.
 */
export type NarrationWitnessVariant = {
    audience: NarrationAudience
    parts: NarrationPart[]
}

/**
 * Narration as its own value, not a field on an action (`AGENT.attemptNarration.planning.md`'s
 * Target shape). `covers` names the action ids this unit narrates. Whatever creates an action
 * authors its unit (Plan's fast-path templates, Expansion's facilitating dissolves). An action no
 * unit covers narrates nothing: positions derives no copy of its own.
 */
export type NarrationUnit = {
    covers: string[]
    variants: NarrationWitnessVariant[]
}
