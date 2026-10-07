import type { TemplateNarrationSpec } from '../../positions/manipulation/kernel/kernelStep'

/**
 * Declares *which rooms* get a witness variant's line, without naming a host: `refs` are the
 * `stableRefKey`s (or `'actor'`) of things the covered actions' sentence is about, and `phase`
 * is when those things' presence is read --- `before` the covered actions, `after` them. Authors
 * reason about the things in the sentence; resolving a ref to a room is a compile-time concern
 * (`AGENT.attemptNarration.planning.md`'s AN-7 stage 2), not this value's.
 */
export type NarrationAudience = {
    refs: string[]
    phase: 'before' | 'after'
}

/**
 * One deliverable line: a template plus the one audience it goes to (AN-2's witness axis).
 * Variants are entries in one `NarrationUnit`, not separate narration units, because every
 * variant's validity is identical --- only text and audience differ, and delivery must not drop
 * one audience's line while delivering another's. A future role variant (RN-1, deferred) adds as
 * another entry of this same shape (keyed by role instead of audience), not a new field.
 */
export type NarrationWitnessVariant = {
    audience: NarrationAudience
    template: TemplateNarrationSpec
}

/**
 * Narration as its own value, not a field on an action (`AGENT.attemptNarration.planning.md`'s
 * Target shape). `covers` names the action ids this unit narrates --- an action no unit covers
 * narrates nothing, except an object-membership action, which gets a positions-side bridge unit
 * synthesized at commit (`commitAttempt.ts`; deleted once an author exists, slice 4).
 */
export type NarrationUnit = {
    covers: string[]
    variants: NarrationWitnessVariant[]
}
